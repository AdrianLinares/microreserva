import { Handler } from '@netlify/functions';
import * as Neon from '@neondatabase/serverless';
import { verifyAdminAuth } from './lib/auth';
const sql: any = (Neon as any).sql ?? (Neon as any).default?.sql;

interface UpdateStatusPayload {
    status: string;
}

interface UpdateDetailsPayload {
    date: string;
    equipmentId: number;
    timeSlotId: string;
}

function getCorsHeaders() {
    return {
        'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
        'Access-Control-Allow-Methods': 'PUT, DELETE, OPTIONS',
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
        // Verify admin auth for all methods
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
        const bookingId = event.queryStringParameters?.id;

        if (!bookingId) {
            return {
                statusCode: 400,
                headers: getCorsHeaders(),
                body: JSON.stringify({ error: 'Missing id parameter' }),
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

            const body = JSON.parse(event.body);

            // Check if this is a status update or details update
            if (body.status) {
                // Update status only
                const statusPayload = body as UpdateStatusPayload;

                await db`UPDATE bookings SET status = ${statusPayload.status} WHERE id = ${bookingId}`;

                return {
                    statusCode: 200,
                    headers: getCorsHeaders(),
                    body: JSON.stringify({ success: true }),
                };
            }

            if (body.date && body.equipmentId !== undefined && body.timeSlotId) {
                // Update details (date, equipmentId, timeSlotId)
                const detailsPayload = body as UpdateDetailsPayload;
                const newId = `${detailsPayload.date}-${detailsPayload.equipmentId}-${detailsPayload.timeSlotId}`;

                // Check if new ID already exists (collision check)
                if (newId !== bookingId) {
                    const collision =
                        await db`SELECT * FROM bookings WHERE id = ${newId}`;

                    if (collision.length > 0) {
                        return {
                            statusCode: 409,
                            headers: getCorsHeaders(),
                            body: JSON.stringify({ error: 'El horario y equipo seleccionados ya están ocupados.' }),
                        };
                    }

                    // Update the booking with new slot details and new ID
                    await db`UPDATE bookings 
            SET id = ${newId}, 
                date = ${detailsPayload.date}, 
                equipment_id = ${detailsPayload.equipmentId}, 
                time_slot_id = ${detailsPayload.timeSlotId}
            WHERE id = ${bookingId}`;
                } else {
                    // ID didn't change, but update the fields anyway
                    await db`UPDATE bookings 
            SET date = ${detailsPayload.date}, 
                equipment_id = ${detailsPayload.equipmentId}, 
                time_slot_id = ${detailsPayload.timeSlotId}
            WHERE id = ${bookingId}`;
                }

                return {
                    statusCode: 200,
                    headers: getCorsHeaders(),
                    body: JSON.stringify({ success: true, newId }),
                };
            }

            return {
                statusCode: 400,
                headers: getCorsHeaders(),
                body: JSON.stringify({ error: 'Invalid request body' }),
            };
        }

        if (event.httpMethod === 'DELETE') {
            await db`DELETE FROM bookings WHERE id = ${bookingId}`;

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
