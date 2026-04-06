import { beforeEach, describe, expect, it, vi } from 'vitest';
import { compare } from 'bcryptjs';
import { verifyAdminAuth } from './auth';

vi.mock('bcryptjs', () => ({
  compare: vi.fn(),
}));

describe('verifyAdminAuth', () => {
  const originalAdminUsers = process.env.ADMIN_USERS;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => { });
    delete process.env.ADMIN_USERS;
  });

  it('returns false when auth header is missing', async () => {
    await expect(verifyAdminAuth(undefined)).resolves.toBe(false);
  });

  it('returns false when header is not Basic auth', async () => {
    process.env.ADMIN_USERS = JSON.stringify([{ username: 'admin', passwordHash: 'hash' }]);

    await expect(verifyAdminAuth('Bearer token')).resolves.toBe(false);
  });

  it('returns false when ADMIN_USERS is invalid JSON', async () => {
    process.env.ADMIN_USERS = '{invalid-json';

    const credentials = Buffer.from('admin:secret').toString('base64');
    await expect(verifyAdminAuth(`Basic ${credentials}`)).resolves.toBe(false);
  });

  it('returns true for a valid admin user and password', async () => {
    process.env.ADMIN_USERS = JSON.stringify([{ username: 'admin', passwordHash: 'hash' }]);
    vi.mocked(compare).mockResolvedValue(true as never);

    const credentials = Buffer.from('admin:secret').toString('base64');
    await expect(verifyAdminAuth(`Basic ${credentials}`)).resolves.toBe(true);
    expect(compare).toHaveBeenCalledWith('secret', 'hash');
  });

  it('returns false for unknown users', async () => {
    process.env.ADMIN_USERS = JSON.stringify([{ username: 'admin', passwordHash: 'hash' }]);

    const credentials = Buffer.from('other:secret').toString('base64');
    await expect(verifyAdminAuth(`Basic ${credentials}`)).resolves.toBe(false);
    expect(compare).not.toHaveBeenCalled();
  });

  afterAll(() => {
    if (originalAdminUsers === undefined) {
      delete process.env.ADMIN_USERS;
      return;
    }
    process.env.ADMIN_USERS = originalAdminUsers;
  });
});