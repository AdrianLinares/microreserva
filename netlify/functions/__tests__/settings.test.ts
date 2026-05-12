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
  const mod = await import('../settings');
  return mod.handler;
}

function baseEvent(overrides: Record<string, unknown> = {}) {
  return {
    httpMethod: 'GET',
    headers: {},
    queryStringParameters: {},
    body: null,
    ...overrides,
  } as any;
}

describe('settings handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifyAdminAuthMock.mockResolvedValue(true);
  });

  it('returns public settings without auth header', async () => {
    const handler = await loadHandler();
    sqlMock.mockResolvedValueOnce([]);

    const response = await handler(baseEvent(), {} as any);

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ nextWeekSlotsLimit: 6 });
  });

  it('returns 401 when auth header exists but is invalid', async () => {
    const handler = await loadHandler();
    verifyAdminAuthMock.mockResolvedValue(false);

    const response = await handler(
      baseEvent({ headers: { authorization: 'Basic invalid' } }),
      {} as any
    );

    expect(response.statusCode).toBe(401);
    expect(JSON.parse(response.body)).toEqual({ error: 'Unauthorized' });
  });

  it('returns 401 on PUT when admin auth fails', async () => {
    const handler = await loadHandler();
    verifyAdminAuthMock.mockResolvedValue(false);

    const response = await handler(
      baseEvent({
        httpMethod: 'PUT',
        headers: { authorization: 'Basic x' },
        body: JSON.stringify({ nextWeekSlotsLimit: 5 }),
      }),
      {} as any
    );

    expect(response.statusCode).toBe(401);
    expect(JSON.parse(response.body)).toEqual({ error: 'Unauthorized' });
  });

  it('returns 400 when nextWeekSlotsLimit is out of range', async () => {
    const handler = await loadHandler();

    const response = await handler(
      baseEvent({
        httpMethod: 'PUT',
        headers: { authorization: 'Basic ok' },
        body: JSON.stringify({ nextWeekSlotsLimit: 0 }),
      }),
      {} as any
    );

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toEqual({
      error: 'nextWeekSlotsLimit must be an integer between 1 and 50',
    });
  });

  it('updates notificationEmail and nextWeekSlotsLimit when payload is valid', async () => {
    const handler = await loadHandler();
    sqlMock.mockResolvedValue([]);

    const response = await handler(
      baseEvent({
        httpMethod: 'PUT',
        headers: { authorization: 'Basic ok' },
        body: JSON.stringify({ notificationEmail: 'admin@example.com', nextWeekSlotsLimit: 7 }),
      }),
      {} as any
    );

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ success: true });
    expect(sqlMock).toHaveBeenCalledTimes(2);
  });
});
