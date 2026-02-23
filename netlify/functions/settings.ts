import { Handler } from '@netlify/functions';
import * as Neon from '@neondatabase/serverless';
import { verifyAdminAuth } from './lib/auth';
const sql: any = (Neon as any).sql ?? (Neon as any).default?.sql;

interface SettingsPayload {
    notificationEmail?: string;
}

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
        // Verify admin auth for both GET and PUT
        const authHeader = event.headers.authorization || event.headers.Authorization;
        const isAuthorized = await verifyAdminAuth(authHeader);

        if (!isAuthorized) {
            return {
                statusCode: 401,
                headers: getCorsHeaders(),
                body: JSON.stringify({ error: 'Unauthorized' }),
            };
        }

        const db = sql(process.env.DATABASE_URL);

        if (event.httpMethod === 'GET') {
            // GET /settings - Return notification email
            const result = await db`SELECT * FROM admin_settings WHERE key = 'notification_email'`;

            const notificationEmail = result.length > 0 ? result[0].value : '';

            return {
                statusCode: 200,
                headers: getCorsHeaders(),
                body: JSON.stringify({ notificationEmail }),
            };
        }

        if (event.httpMethod === 'PUT') {
            if (!event.body) {
                return {
                    statusCode: 400,
                    headers: getCorsHeaders(),
                    body: JSON.stringify({ error: 'Missing request body' }),
                };
            }

            const payload: SettingsPayload = JSON.parse(event.body);

            if (payload.notificationEmail === undefined) {
                return {
                    statusCode: 400,
                    headers: getCorsHeaders(),
                    body: JSON.stringify({ error: 'Missing notificationEmail' }),
                };
            }

            // UPSERT notification_email
            await db`INSERT INTO admin_settings (key, value, updated_at) 
        VALUES ('notification_email', ${payload.notificationEmail}, NOW())
        ON CONFLICT (key) DO UPDATE SET 
          value = ${payload.notificationEmail},
          updated_at = NOW()`;

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
