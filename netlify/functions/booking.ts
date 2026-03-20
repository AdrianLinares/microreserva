import { Handler } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';
import { verifyAdminAuth } from './lib/auth';

if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set');
}

const sql = neon(process.env.DATABASE_URL);

interface UpdateStatusPayload {
    status: string;
    blockedReason?: string;
    blockType?: 'single' | 'range' | 'indefinite';
    blockStartDate?: string;
    blockEndDate?: string;
}

interface UpdateDetailsPayload {
    date: string;
    equipmentId: number;
    timeSlotId: string;
}

function getCorsHeaders() {
    // En desarrollo permitimos cualquier origen; en produccion usamos ALLOWED_ORIGIN
    const isDev = !process.env.NODE_ENV || process.env.NODE_ENV === 'development';
    const allowedOrigin = isDev ? '*' : (process.env.ALLOWED_ORIGIN || '*');

    return {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Methods': 'PUT, DELETE, OPTIONS',
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
        // Este endpoint es solo admin: validamos auth al inicio
        const authHeader = event.headers.authorization || event.headers.Authorization;
        const isAuthorized = await verifyAdminAuth(authHeader);

        if (!isAuthorized) {
            return {
                statusCode: 401,
                headers: getCorsHeaders(),
                body: JSON.stringify({ error: 'Unauthorized' }),
            };
        }

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

            // Este PUT soporta dos casos: cambio de estado o cambio de slot
            if (body.status) {
                // Caso 1: actualizar solo estado
                const statusPayload = body as UpdateStatusPayload;

                // Validacion de estado permitido
                const validStatuses = ['pending', 'approved', 'blocked', 'available'];
                if (!validStatuses.includes(statusPayload.status)) {
                    return {
                        statusCode: 400,
                        headers: getCorsHeaders(),
                        body: JSON.stringify({ error: 'Invalid status value' }),
                    };
                }

                let updatedRows: Array<{ id: string }> = [];

                if (statusPayload.status === 'blocked') {
                    // Si bloqueamos, permitimos adjuntar metadatos de bloqueo.
                    // Cuando no llegan, conservamos los valores existentes.
                    updatedRows = await sql`
                        UPDATE bookings
                        SET status = ${statusPayload.status},
                            blocked_reason = COALESCE(${statusPayload.blockedReason ?? null}, blocked_reason),
                            block_type = COALESCE(${statusPayload.blockType ?? null}, block_type),
                            block_start_date = COALESCE(${statusPayload.blockStartDate ?? null}, block_start_date),
                            block_end_date = COALESCE(${statusPayload.blockEndDate ?? null}, block_end_date)
                        WHERE id = ${bookingId}
                        RETURNING id
                    ` as Array<{ id: string }>;
                } else {
                    // Si el estado deja de ser "blocked", limpiamos metadatos de bloqueo.
                    updatedRows = await sql`
                        UPDATE bookings
                        SET status = ${statusPayload.status},
                            blocked_reason = NULL,
                            block_type = NULL,
                            block_start_date = NULL,
                            block_end_date = NULL
                        WHERE id = ${bookingId}
                        RETURNING id
                    ` as Array<{ id: string }>;
                }

                if (updatedRows.length === 0) {
                    return {
                        statusCode: 404,
                        headers: getCorsHeaders(),
                        body: JSON.stringify({ error: 'Booking not found' }),
                    };
                }

                return {
                    statusCode: 200,
                    headers: getCorsHeaders(),
                    body: JSON.stringify({ success: true }),
                };
            }

            if (body.date && body.equipmentId !== undefined && body.timeSlotId) {
                // Caso 2: mover reserva a nueva fecha/equipo/horario
                const detailsPayload = body as UpdateDetailsPayload;
                const newId = `${detailsPayload.date}-${detailsPayload.equipmentId}-${detailsPayload.timeSlotId}`;

                // Verificamos colision de id en el nuevo slot
                if (newId !== bookingId) {
                    const collision =
                        await sql`SELECT * FROM bookings WHERE id = ${newId}`;

                    if (collision.length > 0) {
                        return {
                            statusCode: 409,
                            headers: getCorsHeaders(),
                            body: JSON.stringify({ error: 'El horario y equipo seleccionados ya están ocupados.' }),
                        };
                    }

                    // Actualizamos id y campos del slot
                    await sql`UPDATE bookings 
            SET id = ${newId}, 
                date = ${detailsPayload.date}, 
                equipment_id = ${detailsPayload.equipmentId}, 
                time_slot_id = ${detailsPayload.timeSlotId}
            WHERE id = ${bookingId}`;
                } else {
                    // Si el id no cambia, igual actualizamos campos editables
                    await sql`UPDATE bookings 
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
            await sql`DELETE FROM bookings WHERE id = ${bookingId}`;

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
