import { Handler } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';
import { verifyAdminAuth } from './lib/auth';

if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set');
}

const sql = neon(process.env.DATABASE_URL);

const MAX_SLOTS_PER_PERSON = 6;
const RATE_LIMIT_WINDOW_MS = 3600000; // 1 hour
const RATE_LIMIT_MAX_INSERTS = 20;

interface DbBooking {
    id: string;
    equipment_id: number;
    date: string;
    time_slot_id: string;
    status: string;
    user_name?: string;
    user_email?: string;
    user_group?: string;
    blocked_reason?: string;
    block_type?: string;
    block_start_date?: string;
    block_end_date?: string;
    timestamp: number;
}

interface ApiBooking {
    id: string;
    equipmentId: number;
    date: string;
    timeSlotId: string;
    status: string;
    userName?: string;
    userEmail?: string;
    userGroup?: string;
    blockedReason?: string;
    blockType?: string;
    blockStartDate?: string;
    blockEndDate?: string;
    timestamp: number;
}

function snakeToCamel(obj: DbBooking): ApiBooking {
    return {
        id: obj.id,
        equipmentId: obj.equipment_id,
        date: obj.date,
        timeSlotId: obj.time_slot_id,
        status: obj.status,
        userName: obj.user_name,
        userEmail: obj.user_email,
        userGroup: obj.user_group,
        blockedReason: obj.blocked_reason,
        blockType: obj.block_type,
        blockStartDate: obj.block_start_date,
        blockEndDate: obj.block_end_date,
        timestamp: obj.timestamp,
    };
}

function camelToSnake(obj: ApiBooking) {
    return {
        id: obj.id,
        equipment_id: obj.equipmentId,
        date: obj.date,
        time_slot_id: obj.timeSlotId,
        status: obj.status,
        user_name: obj.userName,
        user_email: obj.userEmail,
        user_group: obj.userGroup,
        blocked_reason: obj.blockedReason,
        block_type: obj.blockType,
        block_start_date: obj.blockStartDate,
        block_end_date: obj.blockEndDate,
        timestamp: obj.timestamp,
    };
}

function getCorsHeaders() {
    return {
        'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
        if (event.httpMethod === 'GET') {
            // GET /bookings - Return all bookings
            const result = await sql`SELECT * FROM bookings ORDER BY created_at DESC`;
            const bookings = result.map((row) => snakeToCamel(row as any as DbBooking));

            return {
                statusCode: 200,
                headers: getCorsHeaders(),
                body: JSON.stringify(bookings),
            };
        }

        if (event.httpMethod === 'POST') {
            // POST /bookings - Create new booking
            if (!event.body) {
                return {
                    statusCode: 400,
                    headers: getCorsHeaders(),
                    body: JSON.stringify({ error: 'Missing request body' }),
                };
            }

            const booking: ApiBooking = JSON.parse(event.body);

            // Validate required fields
            if (!booking.id || !booking.date || booking.equipmentId === undefined || !booking.timeSlotId) {
                return {
                    statusCode: 400,
                    headers: getCorsHeaders(),
                    body: JSON.stringify({ error: 'Missing required fields: id, date, equipmentId, timeSlotId' }),
                };
            }

            // Validate status is one of allowed values
            const validStatuses = ['pending', 'approved', 'blocked'];
            if (!booking.status || !validStatuses.includes(booking.status)) {
                return {
                    statusCode: 400,
                    headers: getCorsHeaders(),
                    body: JSON.stringify({ error: 'Invalid status. Must be: pending, approved, or blocked' }),
                };
            }

            // Validate date format (YYYY-MM-DD)
            if (!/^\d{4}-\d{2}-\d{2}$/.test(booking.date)) {
                return {
                    statusCode: 400,
                    headers: getCorsHeaders(),
                    body: JSON.stringify({ error: 'Invalid date format. Use YYYY-MM-DD' }),
                };
            }

            // Security: Check authentication for blocked/approved status and block fields
            const authHeader = event.headers.authorization || event.headers.Authorization;
            const isAuthorized = await verifyAdminAuth(authHeader);

            if (!isAuthorized) {
                // Without auth, only allow 'pending' status and no block fields
                if (booking.status !== 'pending') {
                    return {
                        statusCode: 401,
                        headers: getCorsHeaders(),
                        body: JSON.stringify({ error: 'No autorizado para crear reservas con este estado' }),
                    };
                }
                if (booking.blockedReason || booking.blockType || booking.blockStartDate || booking.blockEndDate) {
                    return {
                        statusCode: 401,
                        headers: getCorsHeaders(),
                        body: JSON.stringify({ error: 'No autorizado para crear bloqueos' }),
                    };
                }
            }

            // Generate timestamp server-side to prevent rate limit bypass
            booking.timestamp = Date.now();

            // Check if slot is already occupied by a non-available booking
            const existingBooking = await sql`SELECT * FROM bookings WHERE equipment_id = ${booking.equipmentId} AND date = ${booking.date} AND time_slot_id = ${booking.timeSlotId}`;

            if (existingBooking.length > 0) {
                const existing = existingBooking[0] as any;
                // Only allow overwrite if existing status is 'available'
                if (existing.status !== 'available') {
                    return {
                        statusCode: 409,
                        headers: getCorsHeaders(),
                        body: JSON.stringify({ error: 'Este turno ya ha sido reservado o solicitado.' }),
                    };
                }
            }

            // Enforce MAX_SLOTS_PER_PERSON for pending bookings
            if (booking.status === 'pending' && booking.userEmail) {
                const activeBookings = await sql`SELECT COUNT(*) as count FROM bookings WHERE user_email = ${booking.userEmail} AND status IN ('pending', 'approved')`;

                const activeCount = parseInt((activeBookings[0] as any).count as string, 10);
                if (activeCount >= MAX_SLOTS_PER_PERSON) {
                    return {
                        statusCode: 429,
                        headers: getCorsHeaders(),
                        body: JSON.stringify({
                            error: `Límite excedido. Ya tienes ${activeCount} turnos activos. El máximo es ${MAX_SLOTS_PER_PERSON}.`,
                        }),
                    };
                }
            }

            // Rate limiting: max 20 inserts per email in last 1 hour (only for non-admin users)
            if (booking.userEmail && booking.status === 'pending' && !isAuthorized) {
                const oneHourAgo = Date.now() - RATE_LIMIT_WINDOW_MS;
                const recentInserts = await sql`SELECT COUNT(*) as count FROM bookings WHERE user_email = ${booking.userEmail} AND timestamp > ${oneHourAgo}`;

                const recentCount = parseInt((recentInserts[0] as any).count as string, 10);
                if (recentCount >= RATE_LIMIT_MAX_INSERTS) {
                    return {
                        statusCode: 429,
                        headers: getCorsHeaders(),
                        body: JSON.stringify({
                            error: 'Demasiadas solicitudes en la última hora. Intente más tarde.',
                        }),
                    };
                }
            }

            // Insert or update booking (UPSERT to handle 'available' status entries)
            const snake = camelToSnake(booking);

            // If there's a conflict on ID, update only if the existing entry was 'available'
            // Since we already checked above, we can safely use UPSERT here
            await sql`
        INSERT INTO bookings (id, equipment_id, date, time_slot_id, status, user_name, user_email, user_group, blocked_reason, block_type, block_start_date, block_end_date, timestamp)
        VALUES (${snake.id}, ${snake.equipment_id}, ${snake.date}, ${snake.time_slot_id}, ${snake.status}, ${snake.user_name}, ${snake.user_email}, ${snake.user_group}, ${snake.blocked_reason}, ${snake.block_type}, ${snake.block_start_date}, ${snake.block_end_date}, ${snake.timestamp})
        ON CONFLICT (id) 
        DO UPDATE SET 
            equipment_id = EXCLUDED.equipment_id,
            date = EXCLUDED.date,
            time_slot_id = EXCLUDED.time_slot_id,
            status = EXCLUDED.status,
            user_name = EXCLUDED.user_name,
            user_email = EXCLUDED.user_email,
            user_group = EXCLUDED.user_group,
            blocked_reason = EXCLUDED.blocked_reason,
            block_type = EXCLUDED.block_type,
            block_start_date = EXCLUDED.block_start_date,
            block_end_date = EXCLUDED.block_end_date,
            timestamp = EXCLUDED.timestamp
      `;

            return {
                statusCode: 201,
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
