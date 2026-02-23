import { compare } from 'bcryptjs';

/**
 * Verify admin authentication from Authorization header
 * Expected format: Basic <base64(username:password)>
 */
export async function verifyAdminAuth(authHeader?: string): Promise<boolean> {
    try {
        if (!authHeader) return false;

        const adminUsername = process.env.ADMIN_USERNAME;
        const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;

        if (!adminUsername || !adminPasswordHash) {
            console.error('Admin credentials not configured in environment');
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

        // Verify username matches
        if (username !== adminUsername) {
            return false;
        }

        // Verify password using timing-safe comparison
        const isPasswordValid = await compare(password, adminPasswordHash);
        return isPasswordValid;
    } catch (error) {
        console.error('Auth verification error:', error);
        return false;
    }
}
