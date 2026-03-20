import { Handler } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';
import { verifyAdminAuth } from './lib/auth';

if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set');
}

const sql = neon(process.env.DATABASE_URL);

interface SwapPayload {
    firstId: string;
    secondId: string;
}

function getCorsHeaders() {
    // En desarrollo permitimos cualquier origen; en produccion usamos ALLOWED_ORIGIN
    const isDev = !process.env.NODE_ENV || process.env.NODE_ENV === 'development';
    const allowedOrigin = isDev ? '*' : (process.env.ALLOWED_ORIGIN || '*');

    return {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
        // Solo admin puede intercambiar reservas
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

        // Validaciones basicas del payload
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

        const db = sql;

        // Consultamos ambas reservas a intercambiar
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

        // No se permite intercambio cuando alguna reserva es un bloqueo
        if (firstBooking.status === 'blocked' || secondBooking.status === 'blocked') {
            return {
                statusCode: 400,
                headers: getCorsHeaders(),
                body: JSON.stringify({ error: 'No se pueden intercambiar reservas bloqueadas' }),
            };
        }

        // Calculamos IDs destino segun el slot de la otra reserva
        const firstNewId = `${secondBooking.date}-${secondBooking.equipment_id}-${secondBooking.time_slot_id}`;
        const secondNewId = `${firstBooking.date}-${firstBooking.equipment_id}-${firstBooking.time_slot_id}`;

        // Verificamos conflictos con terceros (excluyendo las dos reservas en swap)
        const collisionCheck =
            await db`SELECT * FROM bookings WHERE id IN (${firstNewId}, ${secondNewId}) AND id NOT IN (${payload.firstId}, ${payload.secondId})`;

        if (collisionCheck.length > 0) {
            return {
                statusCode: 409,
                headers: getCorsHeaders(),
                body: JSON.stringify({ error: 'El intercambio genera un conflicto de horario' }),
            };
        }

        // Swap en 3 pasos con id temporal para evitar colisiones de clave primaria
        const tmpId = `__tmp_${payload.firstId}_${Date.now()}`;

        // Paso 1: mover primera reserva a id temporal
        await db`UPDATE bookings SET id = ${tmpId} WHERE id = ${payload.firstId}`;

        // Paso 2: segunda reserva toma el slot original de la primera
        await db`UPDATE bookings SET 
      id = ${firstNewId}, 
      date = ${firstBooking.date}, 
      equipment_id = ${firstBooking.equipment_id}, 
      time_slot_id = ${firstBooking.time_slot_id}
      WHERE id = ${payload.secondId}`;

        // Paso 3: reserva temporal toma el slot original de la segunda
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
