import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import logger from '../config/logger.js';

interface AdminUser {
    username: string;
    passwordHash: string;
}

// Factorizamos para reusarlo
const verifyAdmin = async (authHeader?: string): Promise<boolean> => {
    try {
        if (!authHeader || !authHeader.startsWith('Basic ')) return false;

        const adminUsersJson = process.env.ADMIN_USERS;
        if (!adminUsersJson) return false;

        const credentials = Buffer.from(authHeader.slice(6), 'base64').toString('utf-8');
        const [username, password] = credentials.split(':');

        if (!username || !password) return false;

        const adminUsers: AdminUser[] = JSON.parse(adminUsersJson);

        for (const admin of adminUsers) {
            if (admin.username === username) {
                return await bcrypt.compare(password, admin.passwordHash);
            }
        }
        return false;
    } catch {
        return false;
    }
};

export const adminAuthMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    const isAuth = await verifyAdmin(req.headers.authorization);
    if (!isAuth) {
        logger.warn(`Intento de login fallido / acceso denegado`, { ip: req.ip });
        res.status(401).json({ error: 'Credenciales inválidas o incompletas' });
        return;
    }
    next();
};

export const optionalAdminAuthMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    (req as any).hasAdminAuthHeader = Boolean(authHeader);
    (req as any).isAuthorizedAdmin = await verifyAdmin(authHeader);
    next();
};
