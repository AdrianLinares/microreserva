import { beforeEach, describe, expect, it, vi } from 'vitest';

const sqlMock = vi.fn();
const verifyAdminAuthMock = vi.fn();

vi.mock('@neondatabase/serverless', () => ({
  neon: vi.fn(() => sqlMock),
}));

vi.mock('../lib/auth', () => ({
  verifyAdminAuth: (...args: unknown[]) => verifyAdminAuthMock(...args),
}));

async function loadHandler() {
  process.env.DATABASE_URL = 'postgres://test';
  vi.resetModules();
  const mod = await import('../bookings');
  return mod.handler;
}

function baseEvent(overrides: Record<string, unknown> = {}) {
  return {
    httpMethod: 'POST',
    headers: {},
    queryStringParameters: {},
    body: null,
    ...overrides,
  } as any;
}

const EQUIPMENT_IDS = [1, 2, 3, 4, 5, 6, 7, 8];
const TIME_SLOT_IDS = ['08:00', '12:00'];

describe('bookings handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifyAdminAuthMock.mockResolvedValue(false);
  });

  describe('POST validations', () => {
    it('returns 400 when POST body is missing', async () => {
      const handler = await loadHandler();

      const response = await handler(baseEvent(), {} as any);

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body)).toEqual({ error: 'Missing request body' });
    });

    it('returns 400 for invalid status values', async () => {
      const handler = await loadHandler();

      const response = await handler(
        baseEvent({
          body: JSON.stringify({
            id: '2026-04-06-1-08:00',
            date: '2026-04-06',
            equipmentId: 1,
            timeSlotId: '08:00',
            status: 'available',
          }),
        }),
        {} as any
      );

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body)).toEqual({
        error: 'Invalid status. Must be: pending, approved, or blocked',
      });
    });

    it('returns 401 when non-admin sends blocking fields', async () => {
      const handler = await loadHandler();
      sqlMock.mockResolvedValueOnce([]);

      const response = await handler(
        baseEvent({
          body: JSON.stringify({
            id: '2026-04-06-1-08:00',
            date: '2026-04-06',
            equipmentId: 1,
            timeSlotId: '08:00',
            status: 'pending',
            blockedReason: 'maintenance',
          }),
        }),
        {} as any
      );

      expect(response.statusCode).toBe(401);
      expect(JSON.parse(response.body)).toEqual({ error: 'No autorizado para crear bloqueos' });
    });

    it('returns 409 when slot is already occupied by non-available booking', async () => {
      const handler = await loadHandler();
      sqlMock.mockResolvedValueOnce([]);
      sqlMock.mockResolvedValueOnce([{ id: 'existing', status: 'approved' }]);

      const response = await handler(
        baseEvent({
          body: JSON.stringify({
            id: '2026-04-06-1-08:00',
            date: '2026-04-06',
            equipmentId: 1,
            timeSlotId: '08:00',
            status: 'pending',
          }),
        }),
        {} as any
      );

      expect(response.statusCode).toBe(409);
      expect(JSON.parse(response.body)).toEqual({
        error: 'Este turno ya ha sido reservado o solicitado.',
      });
    });
  });

  describe('GET holiday synthetic blocks', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-07-08T12:00:00.000Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('injects synthetic blocked rows for holiday dates in current/next week', async () => {
      const handler = await loadHandler();
      sqlMock.mockResolvedValueOnce([]);
      sqlMock.mockResolvedValueOnce([
        { value: JSON.stringify([{ date: '2026-07-08', name: 'Test Holiday' }]) },
      ]);

      const response = await handler(baseEvent({ httpMethod: 'GET' }), {} as any);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveLength(16);

      for (const equipmentId of EQUIPMENT_IDS) {
        for (const timeSlotId of TIME_SLOT_IDS) {
          const synthetic = body.find(
            (row: any) =>
              row.equipmentId === equipmentId &&
              row.timeSlotId === timeSlotId
          );
          expect(synthetic).toEqual({
            id: `holiday-2026-07-08-${equipmentId}-${timeSlotId}`,
            equipmentId,
            date: '2026-07-08',
            timeSlotId,
            status: 'blocked',
            blockType: 'single',
            blockedReason: 'Día festivo',
            timestamp: 0,
          });
        }
      }
    });

    it('does not inject synthetic rows for holidays outside current/next week span', async () => {
      const handler = await loadHandler();
      sqlMock.mockResolvedValueOnce([]);
      sqlMock.mockResolvedValueOnce([
        { value: JSON.stringify([{ date: '2026-07-22', name: 'Future Holiday' }]) },
      ]);

      const response = await handler(baseEvent({ httpMethod: 'GET' }), {} as any);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveLength(0);
    });

    it('skips injection when a real booking already occupies the slot', async () => {
      const handler = await loadHandler();
      sqlMock.mockResolvedValueOnce([
        {
          id: '2026-07-08-1-08:00',
          equipment_id: 1,
          date: '2026-07-08',
          time_slot_id: '08:00',
          status: 'approved',
          timestamp: 1,
        },
      ]);
      sqlMock.mockResolvedValueOnce([
        { value: JSON.stringify([{ date: '2026-07-08', name: 'Test Holiday' }]) },
      ]);

      const response = await handler(baseEvent({ httpMethod: 'GET' }), {} as any);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveLength(16);
      expect(body.some((row: any) => row.id === 'holiday-2026-07-08-1-08:00')).toBe(false);
      expect(body.some((row: any) => row.id === '2026-07-08-1-08:00')).toBe(true);
    });
  });

  describe('POST holiday guard', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-07-08T12:00:00.000Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('rejects reservation on a holiday date with 400', async () => {
      const handler = await loadHandler();
      sqlMock.mockResolvedValueOnce([
        { value: JSON.stringify([{ date: '2026-07-08', name: 'Test Holiday' }]) },
      ]);

      const response = await handler(
        baseEvent({
          body: JSON.stringify({
            id: '2026-07-08-1-08:00',
            date: '2026-07-08',
            equipmentId: 1,
            timeSlotId: '08:00',
            status: 'pending',
          }),
        }),
        {} as any
      );

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body)).toEqual({
        error: 'No se pueden hacer reservas en días festivos.',
      });
      expect(sqlMock).toHaveBeenCalledTimes(1);
    });

    it('allows reservation on a non-holiday date', async () => {
      const handler = await loadHandler();
      sqlMock.mockResolvedValueOnce([]);
      sqlMock.mockResolvedValueOnce([]);
      sqlMock.mockResolvedValueOnce([]);

      const response = await handler(
        baseEvent({
          body: JSON.stringify({
            id: '2026-07-07-1-08:00',
            date: '2026-07-07',
            equipmentId: 1,
            timeSlotId: '08:00',
            status: 'pending',
          }),
        }),
        {} as any
      );

      expect(response.statusCode).toBe(201);
      expect(JSON.parse(response.body)).toMatchObject({ success: true });
    });
  });
});
