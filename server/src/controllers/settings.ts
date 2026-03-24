import { Request, Response } from 'express';
import { query } from '../config/db.js';
import logger from '../config/logger.js';

interface SettingsPayload {
    notificationEmail?: string;
    nextWeekSlotsLimit?: number;
}

const DEFAULT_NEXT_WEEK_SLOTS_LIMIT = 6;

export const getSettings = async (req: Request, res: Response): Promise<void> => {
    try {
        const hasAuthHeader = (req as any).hasAdminAuthHeader === true;
        const isAuthorized = (req as any).isAuthorizedAdmin === true;

        if (hasAuthHeader && !isAuthorized) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const result = await query("SELECT key, value FROM admin_settings WHERE key IN ('notification_email', 'next_week_slots_limit')");

        const settingsMap = new Map<string, string>();
        result.rows.forEach((row: any) => settingsMap.set(row.key, row.value));

        const nextWeekSlotsLimitRaw = settingsMap.get('next_week_slots_limit');
        const parsedLimit = nextWeekSlotsLimitRaw ? Number.parseInt(nextWeekSlotsLimitRaw, 10) : NaN;
        const nextWeekSlotsLimit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : DEFAULT_NEXT_WEEK_SLOTS_LIMIT;

        if (!isAuthorized) {
            res.status(200).json({ nextWeekSlotsLimit });
            return;
        }

        const notificationEmail = settingsMap.get('notification_email') || '';
        res.status(200).json({ notificationEmail, nextWeekSlotsLimit });
    } catch (error) {
        logger.error('Error fetching settings', { error });
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const updateSettings = async (req: Request, res: Response): Promise<void> => {
    try {
        const payload: SettingsPayload = req.body;

        if (payload.notificationEmail === undefined && payload.nextWeekSlotsLimit === undefined) {
            res.status(400).json({ error: 'Missing settings payload' });
            return;
        }

        if (payload.notificationEmail !== undefined) {
            await query(`
                INSERT INTO admin_settings (key, value, updated_at)
                VALUES ('notification_email', $1, NOW())
                ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
            `, [payload.notificationEmail]);
        }

        if (payload.nextWeekSlotsLimit !== undefined) {
            if (!Number.isInteger(payload.nextWeekSlotsLimit) || payload.nextWeekSlotsLimit < 1 || payload.nextWeekSlotsLimit > 50) {
                res.status(400).json({ error: 'nextWeekSlotsLimit must be an integer between 1 and 50' });
                return;
            }

            await query(`
                INSERT INTO admin_settings (key, value, updated_at)
                VALUES ('next_week_slots_limit', $1, NOW())
                ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
            `, [String(payload.nextWeekSlotsLimit)]);
        }

        logger.info('Configuracion del sistema actualizada');
        res.status(200).json({ success: true });
    } catch (error) {
        logger.error('Error updating settings', { error });
        res.status(500).json({ error: 'Internal server error' });
    }
};
