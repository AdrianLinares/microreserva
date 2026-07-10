import { Handler } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';
import { HolidayEntry } from '../../src/types';
import { verifyAdminAuth } from './lib/auth';

if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set');
}

const sql = neon(process.env.DATABASE_URL);

interface SettingsPayload {
    notificationEmail?: string;
    nextWeekSlotsLimit?: number;
    holidays?: HolidayEntry[];
}

const DEFAULT_NEXT_WEEK_SLOTS_LIMIT = 6;

function parseIsoDateToUtc(date: string): Date {
    const [year, month, day] = date.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day));
}

function formatUtcDate(date: Date): string {
    return date.toISOString().split('T')[0];
}

function validateHolidays(holidays: unknown): HolidayEntry[] {
    if (!Array.isArray(holidays)) {
        throw new Error('holidays must be an array');
    }

    const seenDates = new Set<string>();

    for (const entry of holidays) {
        if (!entry || typeof entry !== 'object' || typeof (entry as HolidayEntry).date !== 'string' || typeof (entry as HolidayEntry).name !== 'string') {
            throw new Error('Each holiday must have a name and a date');
        }

        const { date, name } = entry as HolidayEntry;

        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            throw new Error(`Invalid holiday date format: ${date}. Use YYYY-MM-DD`);
        }

        const parsed = parseIsoDateToUtc(date);
        if (formatUtcDate(parsed) !== date) {
            throw new Error(`Invalid holiday date: ${date}`);
        }

        if (seenDates.has(date)) {
            throw new Error(`Duplicate holiday date: ${date}`);
        }
        seenDates.add(date);
    }

    return holidays as HolidayEntry[];
}

function getCorsHeaders() {
    // En desarrollo permitimos cualquier origen; en produccion usamos ALLOWED_ORIGIN
    const isDev = !process.env.NODE_ENV || process.env.NODE_ENV === 'development';
    const allowedOrigin = isDev ? '*' : (process.env.ALLOWED_ORIGIN || '*');

    return {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Content-Type': 'application/json',
    };
}

const handler: Handler = async (event, context) => {
    // Respuesta al preflight CORS
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

            const result = await db`SELECT key, value FROM admin_settings WHERE key IN ('notification_email', 'next_week_slots_limit', 'holidays')`;
            const settingsMap = new Map<string, string>();
            result.forEach((row: any) => settingsMap.set(row.key, row.value));

            const nextWeekSlotsLimitRaw = settingsMap.get('next_week_slots_limit');
            const parsedLimit = nextWeekSlotsLimitRaw ? Number.parseInt(nextWeekSlotsLimitRaw, 10) : NaN;
            const nextWeekSlotsLimit = Number.isFinite(parsedLimit) && parsedLimit > 0
                ? parsedLimit
                : DEFAULT_NEXT_WEEK_SLOTS_LIMIT;

            let holidays: HolidayEntry[] = [];
            const holidaysRaw = settingsMap.get('holidays');
            if (holidaysRaw) {
                try {
                    holidays = JSON.parse(holidaysRaw) as HolidayEntry[];
                } catch {
                    holidays = [];
                }
            }

            if (!isAuthorized) {
                return {
                    statusCode: 200,
                    headers: getCorsHeaders(),
                    body: JSON.stringify({ nextWeekSlotsLimit, holidays }),
                };
            }

            const notificationEmail = settingsMap.get('notification_email') || '';

            return {
                statusCode: 200,
                headers: getCorsHeaders(),
                body: JSON.stringify({ notificationEmail, nextWeekSlotsLimit, holidays }),
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

            if (payload.notificationEmail === undefined && payload.nextWeekSlotsLimit === undefined && payload.holidays === undefined) {
                return {
                    statusCode: 400,
                    headers: getCorsHeaders(),
                    body: JSON.stringify({ error: 'Missing settings payload' }),
                };
            }

            if (payload.holidays !== undefined) {
                try {
                    validateHolidays(payload.holidays);
                } catch (error) {
                    return {
                        statusCode: 400,
                        headers: getCorsHeaders(),
                        body: JSON.stringify({ error: error instanceof Error ? error.message : 'Invalid holidays payload' }),
                    };
                }

                await db`INSERT INTO admin_settings (key, value, updated_at)
                VALUES ('holidays', ${JSON.stringify(payload.holidays)}, NOW())
                ON CONFLICT (key) DO UPDATE SET
                    value = EXCLUDED.value,
                    updated_at = NOW()`;
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
