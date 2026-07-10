import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addBooking,
  clearAdminCredentials,
  deleteBooking,
  getAdminSettings,
  getBookings,
  getHolidays,
  getPublicSettings,
  saveAdminCredentials,
  saveHolidays,
} from './api';

const bookingBase = {
  id: '2026-04-06-1-08:00',
  equipmentId: 1,
  date: '2026-04-06',
  timeSlotId: '08:00',
  timestamp: 0,
} as const;

function createOkResponse(data: unknown = {}) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: vi.fn().mockResolvedValue(data),
    text: vi.fn().mockResolvedValue(''),
  } as unknown as Response;
}

describe('api service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  it('throws when admin endpoint is called without credentials', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(createOkResponse());

    await expect(getAdminSettings()).rejects.toThrow('Admin credentials not found');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('stores and uses Basic auth credentials for protected endpoints', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(createOkResponse({ success: true }));
    saveAdminCredentials('admin', 'secret');

    await deleteBooking('slot with spaces');

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, options] = fetchSpy.mock.calls[0];
    expect(String(url)).toContain('/.netlify/functions/booking?id=slot%20with%20spaces');
    expect((options as RequestInit).headers).toMatchObject({
      Authorization: 'Basic YWRtaW46c2VjcmV0',
      'Content-Type': 'application/json',
    });
  });

  it('allows creating pending bookings without admin credentials', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(createOkResponse({ success: true }));

    await addBooking({ ...bookingBase, status: 'pending' });

    const [, options] = fetchSpy.mock.calls[0];
    expect((options as RequestInit).headers).not.toHaveProperty('Authorization');
  });

  it('requires admin credentials when creating approved bookings', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(createOkResponse({ success: true }));

    await expect(addBooking({ ...bookingBase, status: 'approved' })).rejects.toThrow(
      'Admin credentials not found'
    );
  });

  it('uses no-store cache for GET endpoints', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(createOkResponse([]));

    await getBookings();
    await getPublicSettings();

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect((fetchSpy.mock.calls[0][1] as RequestInit).cache).toBe('no-store');
    expect((fetchSpy.mock.calls[1][1] as RequestInit).cache).toBe('no-store');
  });

  it('clears stored admin credentials', () => {
    saveAdminCredentials('admin', 'secret');
    clearAdminCredentials();

    expect(sessionStorage.getItem('micro_admin_token')).toBeNull();
  });

  it('returns holidays from public settings', async () => {
    const holidays = [{ date: '2026-01-01', name: 'Año Nuevo' }];
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      createOkResponse({ nextWeekSlotsLimit: 6, holidays })
    );

    const result = await getHolidays();

    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(String(fetchSpy.mock.calls[0][0])).toContain('/settings');
    expect(result).toEqual(holidays);
  });

  it('sends holidays array on authenticated PUT', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(createOkResponse({ success: true }));
    saveAdminCredentials('admin', 'secret');
    const holidays = [{ date: '2026-01-01', name: 'Año Nuevo' }];

    await saveHolidays(holidays);

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [, options] = fetchSpy.mock.calls[0];
    expect((options as RequestInit).method).toBe('PUT');
    expect((options as RequestInit).headers).toMatchObject({
      Authorization: 'Basic YWRtaW46c2VjcmV0',
    });
    expect(JSON.parse((options as RequestInit).body as string)).toEqual({ holidays });
  });

  it('throws when saving holidays without admin credentials', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(createOkResponse());

    await expect(saveHolidays([])).rejects.toThrow('Admin credentials not found');
  });
});