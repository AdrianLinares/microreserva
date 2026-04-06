import { beforeEach, describe, expect, it, vi } from 'vitest';

const sqlMock = vi.fn();
const verifyAdminAuthMock = vi.fn();

vi.mock('@neondatabase/serverless', () => ({
  neon: vi.fn(() => sqlMock),
}));

vi.mock('./lib/auth', () => ({
  verifyAdminAuth: (...args: unknown[]) => verifyAdminAuthMock(...args),
}));

async function loadHandler() {
  process.env.DATABASE_URL = 'postgres://test';
  vi.resetModules();
  const mod = await import('./bookings');
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

describe('bookings handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifyAdminAuthMock.mockResolvedValue(false);
  });

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
