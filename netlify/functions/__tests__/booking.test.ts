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
  const mod = await import('../booking');
  return mod.handler;
}

function baseEvent(overrides: Record<string, unknown> = {}) {
  return {
    httpMethod: 'PUT',
    headers: {},
    queryStringParameters: { id: 'booking-1' },
    body: JSON.stringify({ status: 'approved' }),
    ...overrides,
  } as any;
}

describe('booking handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifyAdminAuthMock.mockResolvedValue(true);
  });

  it('returns 401 when admin auth fails', async () => {
    const handler = await loadHandler();
    verifyAdminAuthMock.mockResolvedValue(false);

    const response = await handler(baseEvent(), {} as any);

    expect(response.statusCode).toBe(401);
    expect(JSON.parse(response.body)).toEqual({ error: 'Unauthorized' });
  });

  it('returns 400 when id query param is missing', async () => {
    const handler = await loadHandler();

    const response = await handler(baseEvent({ queryStringParameters: {} }), {} as any);

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toEqual({ error: 'Missing id parameter' });
  });

  it('returns 400 for invalid status value', async () => {
    const handler = await loadHandler();

    const response = await handler(
      baseEvent({ body: JSON.stringify({ status: 'invalid-status' }) }),
      {} as any
    );

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toEqual({ error: 'Invalid status value' });
  });

  it('returns 404 when status update does not find booking', async () => {
    const handler = await loadHandler();
    sqlMock.mockResolvedValueOnce([]);

    const response = await handler(
      baseEvent({ body: JSON.stringify({ status: 'blocked', blockedReason: 'maintenance' }) }),
      {} as any
    );

    expect(response.statusCode).toBe(404);
    expect(JSON.parse(response.body)).toEqual({ error: 'Booking not found' });
  });

  it('returns 409 when moving to an occupied slot', async () => {
    const handler = await loadHandler();
    sqlMock.mockResolvedValueOnce([{ id: 'occupied' }]);

    const response = await handler(
      baseEvent({
        queryStringParameters: { id: 'old-id' },
        body: JSON.stringify({ date: '2026-04-10', equipmentId: 1, timeSlotId: '09:00' }),
      }),
      {} as any
    );

    expect(response.statusCode).toBe(409);
    expect(JSON.parse(response.body)).toEqual({
      error: 'El horario y equipo seleccionados ya están ocupados.',
    });
  });
});
