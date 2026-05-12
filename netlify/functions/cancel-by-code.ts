import { Handler } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set');
}

const sql = neon(process.env.DATABASE_URL);

function getCorsHeaders() {
    const isDev = !process.env.NODE_ENV || process.env.NODE_ENV === 'development';
    const allowedOrigin = isDev ? '*' : (process.env.ALLOWED_ORIGIN || '*');

    return {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Content-Type': 'application/json',
    };
}

/**
 * Genera la fecha/hora de inicio del turno en tiempo de Bogota (UTC-5)
 * para comparar con la hora actual. No se usa zona horaria del servidor.
 */
function getBookingStartTimeBogota(date: string, timeSlotId: string): Date {
    // El timeSlotId es la hora de inicio, ej "08:00"
    return new Date(`${date}T${timeSlotId}:00-05:00`);
}

const handler: Handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: getCorsHeaders(),
            body: '',
        };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers: getCorsHeaders(),
            body: JSON.stringify({ error: 'Method not allowed' }),
        };
    }

    try {
        if (!event.body) {
            return {
                statusCode: 400,
                headers: getCorsHeaders(),
                body: JSON.stringify({ error: 'Missing request body' }),
            };
        }

        const { code, email } = JSON.parse(event.body);

        if (!code || !email) {
            return {
                statusCode: 400,
                headers: getCorsHeaders(),
                body: JSON.stringify({ error: 'Faltan datos: código y email son requeridos.' }),
            };
        }

        // Normalizamos email: minúsculas + trim para evitar errores de mayúsculas
        const normalizedEmail = email.toString().trim().toLowerCase();
        const normalizedCode = code.toString().trim();

        // Buscamos la reserva por código de cancelación
        const bookings = await sql`
            SELECT * FROM bookings
            WHERE cancellation_code = ${normalizedCode}
            LIMIT 1
        `;

        if (bookings.length === 0) {
            return {
                statusCode: 404,
                headers: getCorsHeaders(),
                body: JSON.stringify({ error: 'Código de cancelación no válido.' }),
            };
        }

        const booking = bookings[0] as any;

        // Verificamos email (case-insensitive)
        const bookingEmail = (booking.user_email || '').toString().trim().toLowerCase();
        if (bookingEmail !== normalizedEmail) {
            return {
                statusCode: 401,
                headers: getCorsHeaders(),
                body: JSON.stringify({ error: 'El email no coincide con la solicitud original.' }),
            };
        }

        // Solo permitimos cancelar si está pendiente o aprobada
        if (booking.status !== 'pending' && booking.status !== 'approved') {
            return {
                statusCode: 400,
                headers: getCorsHeaders(),
                body: JSON.stringify({ error: 'Esta reserva ya no puede cancelarse.' }),
            };
        }

        // Verificamos que la fecha sea futura en hora Bogota
        const bookingStart = getBookingStartTimeBogota(booking.date, booking.time_slot_id);
        if (bookingStart <= new Date()) {
            return {
                statusCode: 400,
                headers: getCorsHeaders(),
                body: JSON.stringify({ error: 'No se puede cancelar un turno que ya pasó.' }),
            };
        }

        // Cancelamos: status a available + invalidamos código (uso único)
        await sql`
            UPDATE bookings
            SET status = 'available', user_name = NULL, user_email = NULL, user_group = NULL,
                cancellation_code = NULL, timestamp = ${Date.now()}
            WHERE id = ${booking.id}
        `;

        return {
            statusCode: 200,
            headers: getCorsHeaders(),
            body: JSON.stringify({ success: true }),
        };
    } catch (error) {
        console.error('Error in cancel-by-code:', error);
        return {
            statusCode: 500,
            headers: getCorsHeaders(),
            body: JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
        };
    }
};

export { handler };
