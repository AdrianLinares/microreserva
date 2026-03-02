import { Handler } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';
import { verifyAdminAuth } from './lib/auth';

if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set');
}

const sql = neon(process.env.DATABASE_URL);

interface SettingsPayload {
    notificationEmail?: string;
    nextWeekSlotsLimit?: number;
}

const DEFAULT_NEXT_WEEK_SLOTS_LIMIT = 6;

function getCorsHeaders() {
    return {
        'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
        'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Content-Type': 'application/json',
    };
}

const handler: Handler = async (event, context) => {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: getCorsHeaders(),
            body: '',
        };
    }

    try {
        const db = sql;

        if (event.httpMethod === 'GET') {
            const authHeader = event.headers.authorization || event.headers.Authorization;
            const hasAuthHeader = Boolean(authHeader);
            const isAuthorized = hasAuthHeader ? await verifyAdminAuth(authHeader) : false;

            if (hasAuthHeader && !isAuthorized) {
                return {
                    statusCode: 401,
                    headers: getCorsHeaders(),
                    body: JSON.stringify({ error: 'Unauthorized' }),
                };
            }

            const result = await db`SELECT key, value FROM admin_settings WHERE key IN ('notification_email', 'next_week_slots_limit')`;
            const settingsMap = new Map<string, string>();
            result.forEach((row: any) => settingsMap.set(row.key, row.value));

            const nextWeekSlotsLimitRaw = settingsMap.get('next_week_slots_limit');
            const parsedLimit = nextWeekSlotsLimitRaw ? Number.parseInt(nextWeekSlotsLimitRaw, 10) : NaN;
            const nextWeekSlotsLimit = Number.isFinite(parsedLimit) && parsedLimit > 0
                ? parsedLimit
                : DEFAULT_NEXT_WEEK_SLOTS_LIMIT;

            if (!isAuthorized) {
                return {
                    statusCode: 200,
                    headers: getCorsHeaders(),
                    body: JSON.stringify({ nextWeekSlotsLimit }),
                };
            }

            const notificationEmail = settingsMap.get('notification_email') || '';

            return {
                statusCode: 200,
                headers: getCorsHeaders(),
                body: JSON.stringify({ notificationEmail, nextWeekSlotsLimit }),
            };
        }

        if (event.httpMethod === 'PUT') {
            const authHeader = event.headers.authorization || event.headers.Authorization;
            const isAuthorized = await verifyAdminAuth(authHeader);

            if (!isAuthorized) {
                return {
                    statusCode: 401,
                    headers: getCorsHeaders(),
                    body: JSON.stringify({ error: 'Unauthorized' }),
                };
            }

            if (!event.body) {
                return {
                    statusCode: 400,
                    headers: getCorsHeaders(),
                    body: JSON.stringify({ error: 'Missing request body' }),
                };
            }

            const payload: SettingsPayload = JSON.parse(event.body);

            if (payload.notificationEmail === undefined && payload.nextWeekSlotsLimit === undefined) {
                return {
                    statusCode: 400,
                    headers: getCorsHeaders(),
                    body: JSON.stringify({ error: 'Missing settings payload' }),
                };
            }

            if (payload.notificationEmail !== undefined) {
                await db`INSERT INTO admin_settings (key, value, updated_at)
                VALUES ('notification_email', ${payload.notificationEmail}, NOW())
                ON CONFLICT (key) DO UPDATE SET
                    value = EXCLUDED.value,
                    updated_at = NOW()`;
            }

            if (payload.nextWeekSlotsLimit !== undefined) {
                if (!Number.isInteger(payload.nextWeekSlotsLimit) || payload.nextWeekSlotsLimit < 1 || payload.nextWeekSlotsLimit > 50) {
                    return {
                        statusCode: 400,
                        headers: getCorsHeaders(),
                        body: JSON.stringify({ error: 'nextWeekSlotsLimit must be an integer between 1 and 50' }),
                    };
                }

                await db`INSERT INTO admin_settings (key, value, updated_at)
                VALUES ('next_week_slots_limit', ${String(payload.nextWeekSlotsLimit)}, NOW())
                ON CONFLICT (key) DO UPDATE SET
                    value = EXCLUDED.value,
                    updated_at = NOW()`;
            }

            return {
                statusCode: 200,
                headers: getCorsHeaders(),
                body: JSON.stringify({ success: true }),
            };
        }

        return {
            statusCode: 405,
            headers: getCorsHeaders(),
            body: JSON.stringify({ error: 'Method not allowed' }),
        };
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers: getCorsHeaders(),
            body: JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
        };
    }
};

export { handler };
