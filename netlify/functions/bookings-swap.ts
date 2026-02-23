import { Handler } from '@netlify/functions';
import { sql } from '@neondatabase/serverless';
import { verifyAdminAuth } from './lib/auth';

interface SwapPayload {
    firstId: string;
    secondId: string;
}

function getCorsHeaders() {
    return {
        'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
        // Verify admin auth
        const authHeader = event.headers.authorization || event.headers.Authorization;
        const isAuthorized = await verifyAdminAuth(authHeader);

        if (!isAuthorized) {
            return {
                statusCode: 401,
                headers: getCorsHeaders(),
                body: JSON.stringify({ error: 'Unauthorized' }),
            };
        }

        if (event.httpMethod !== 'POST') {
            return {
                statusCode: 405,
                headers: getCorsHeaders(),
                body: JSON.stringify({ error: 'Method not allowed' }),
            };
        }

        if (!event.body) {
            return {
                statusCode: 400,
                headers: getCorsHeaders(),
                body: JSON.stringify({ error: 'Missing request body' }),
            };
        }

        const payload: SwapPayload = JSON.parse(event.body);

        // Validate inputs
        if (!payload.firstId || !payload.secondId) {
            return {
                statusCode: 400,
                headers: getCorsHeaders(),
                body: JSON.stringify({ error: 'Missing firstId or secondId' }),
            };
        }

        if (payload.firstId === payload.secondId) {
            return {
                statusCode: 400,
                headers: getCorsHeaders(),
                body: JSON.stringify({ error: 'Seleccione reservas diferentes' }),
            };
        }

        const db = sql(process.env.DATABASE_URL);

        // Fetch both bookings
        const firstResult = await db`SELECT * FROM bookings WHERE id = ${payload.firstId}`;
        const secondResult = await db`SELECT * FROM bookings WHERE id = ${payload.secondId}`;

        if (firstResult.length === 0 || secondResult.length === 0) {
            return {
                statusCode: 404,
                headers: getCorsHeaders(),
                body: JSON.stringify({ error: 'Reserva no encontrada' }),
            };
        }

        const firstBooking = firstResult[0];
        const secondBooking = secondResult[0];

        // Reject if either is blocked
        if (firstBooking.status === 'blocked' || secondBooking.status === 'blocked') {
            return {
                statusCode: 400,
                headers: getCorsHeaders(),
                body: JSON.stringify({ error: 'No se pueden intercambiar reservas bloqueadas' }),
            };
        }

        // Calculate new IDs after swap
        const firstNewId = `${secondBooking.date}-${secondBooking.equipment_id}-${secondBooking.time_slot_id}`;
        const secondNewId = `${firstBooking.date}-${firstBooking.equipment_id}-${firstBooking.time_slot_id}`;

        // Check for collisions (exclude the two being swapped)
        const collisionCheck =
            await db`SELECT * FROM bookings WHERE id IN (${firstNewId}, ${secondNewId}) AND id NOT IN (${payload.firstId}, ${payload.secondId})`;

        if (collisionCheck.length > 0) {
            return {
                statusCode: 409,
                headers: getCorsHeaders(),
                body: JSON.stringify({ error: 'El intercambio genera un conflicto de horario' }),
            };
        }

        // Perform atomic swap using temporary ID
        const tmpId = `__tmp_${payload.firstId}_${Date.now()}`;

        // Step 1: Rename first booking to temporary ID
        await db`UPDATE bookings SET id = ${tmpId} WHERE id = ${payload.firstId}`;

        // Step 2: Update second booking to first booking's old slot data
        await db`UPDATE bookings SET 
      id = ${firstNewId}, 
      date = ${firstBooking.date}, 
      equipment_id = ${firstBooking.equipment_id}, 
      time_slot_id = ${firstBooking.time_slot_id}
      WHERE id = ${payload.secondId}`;

        // Step 3: Rename temp booking to second booking's new ID with second's slot data
        await db`UPDATE bookings SET 
      id = ${secondNewId}, 
      date = ${secondBooking.date}, 
      equipment_id = ${secondBooking.equipment_id}, 
      time_slot_id = ${secondBooking.time_slot_id}
      WHERE id = ${tmpId}`;

        return {
            statusCode: 200,
            headers: getCorsHeaders(),
            body: JSON.stringify({ success: true }),
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
