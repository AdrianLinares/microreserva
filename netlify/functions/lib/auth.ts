import { compare } from 'bcryptjs';

interface AdminUser {
    username: string;
    passwordHash: string;
}

/**
 * Verify admin authentication from Authorization header
 * Expected format: Basic <base64(username:password)>
 */
export async function verifyAdminAuth(authHeader?: string): Promise<boolean> {
    try {
        if (!authHeader) return false;

        const adminUsersJson = process.env.ADMIN_USERS;

        if (!adminUsersJson) {
            console.error('Admin users not configured in environment');
            return false;
        }

        // Parse Basic auth header
        if (!authHeader.startsWith('Basic ')) {
            return false;
        }

        const base64Credentials = authHeader.slice(6);
        const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
        const [username, password] = credentials.split(':');

        if (!username || !password) {
            return false;
        }

        // Parse admin users
        let adminUsers: AdminUser[];
        try {
            adminUsers = JSON.parse(adminUsersJson);
        } catch (error) {
            console.error('Invalid ADMIN_USERS JSON format:', error);
            return false;
        }

        if (!Array.isArray(adminUsers) || adminUsers.length === 0) {
            console.error('No admin users configured');
            return false;
        }

        // Find user and verify password
        for (const admin of adminUsers) {
            if (admin.username === username) {
                const isPasswordValid = await compare(password, admin.passwordHash);
                if (isPasswordValid) {
                    return true;
                }
            }
        }

        return false;
    } catch (error) {
        console.error('Auth verification error:', error);
        return false;
    }
}
