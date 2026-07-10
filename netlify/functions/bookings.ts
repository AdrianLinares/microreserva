import crypto from 'crypto';
import { Handler } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';
import { verifyAdminAuth } from './lib/auth';

if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set');
}

const sql = neon(process.env.DATABASE_URL);

const DEFAULT_NEXT_WEEK_SLOTS_LIMIT = 6;
const RATE_LIMIT_WINDOW_MS = 3600000; // 1 hora
const RATE_LIMIT_MAX_INSERTS = 20;

/**
 * Genera un codigo alfanumerico de 10 caracteres criptograficamente aleatorio.
 * Usa crypto.randomBytes para garantizar entropia real.
 */
function generateCancellationCode(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    const bytes = crypto.randomBytes(10);
    let code = '';
    for (let i = 0; i < 10; i++) {
        code += chars[bytes[i] % chars.length];
    }
    return code;
}

function parseIsoDateToUtc(date: string): Date {
    const [year, month, day] = date.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day));
}

function getMondayUtc(date: Date): Date {
    const monday = new Date(date);
    const day = monday.getUTCDay(); // 0 domingo, 1 lunes, ... 6 sabado
    const diffToMonday = day === 0 ? -6 : 1 - day;
    monday.setUTCDate(monday.getUTCDate() + diffToMonday);
    monday.setUTCHours(0, 0, 0, 0);
    return monday;
}

function formatUtcDate(date: Date): string {
    return date.toISOString().split('T')[0];
}

function getWeekRangeUtc(date: Date): { start: string; endExclusive: string } {
    const weekStart = getMondayUtc(date);
    const weekEndExclusive = new Date(weekStart);
    weekEndExclusive.setUTCDate(weekEndExclusive.getUTCDate() + 7);
    return {
        start: formatUtcDate(weekStart),
        endExclusive: formatUtcDate(weekEndExclusive),
    };
}

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
    // En desarrollo permitimos cualquier origen; en produccion respetamos ALLOWED_ORIGIN
    const isDev = !process.env.NODE_ENV || process.env.NODE_ENV === 'development';
    const allowedOrigin = isDev ? '*' : (process.env.ALLOWED_ORIGIN || '*');

    return {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Content-Type': 'application/json',
    };
}

const EQUIPMENT_IDS = [1, 2, 3, 4, 5, 6, 7, 8];
const TIME_SLOT_IDS = ['08:00', '12:00'];

interface HolidayEntry {
    date: string;
    name: string;
}

async function getHolidays(): Promise<HolidayEntry[]> {
    try {
        const result = await sql`SELECT value FROM admin_settings WHERE key = 'holidays'`;
        if (result.length === 0) {
            return [];
        }
        const parsed = JSON.parse((result[0] as any).value ?? '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.error('Error reading holidays:', error);
        return [];
    }
}

function getHolidayDateSpan(): { start: Date; endExclusive: Date } {
    const currentMonday = getMondayUtc(new Date());
    const endExclusive = new Date(currentMonday);
    endExclusive.setUTCDate(endExclusive.getUTCDate() + 14);
    return { start: currentMonday, endExclusive };
}

function isDateInHolidaySpan(dateStr: string, start: Date, endExclusive: Date): boolean {
    const date = parseIsoDateToUtc(dateStr);
    return date >= start && date < endExclusive;
}

function injectHolidayBlocks(bookings: ApiBooking[], holidays: HolidayEntry[]): ApiBooking[] {
    const { start, endExclusive } = getHolidayDateSpan();
    const activeHolidayDates = Array.from(
        new Set(
            holidays
                .filter((holiday) => isDateInHolidaySpan(holiday.date, start, endExclusive))
                .map((holiday) => holiday.date)
        )
    );

    if (activeHolidayDates.length === 0) {
        return bookings;
    }

    const occupiedKeys = new Set(
        bookings.map((booking) => `${booking.date}-${booking.equipmentId}-${booking.timeSlotId}`)
    );
    const synthetics: ApiBooking[] = [];

    for (const date of activeHolidayDates) {
        for (const equipmentId of EQUIPMENT_IDS) {
            for (const timeSlotId of TIME_SLOT_IDS) {
                const slotKey = `${date}-${equipmentId}-${timeSlotId}`;
                if (occupiedKeys.has(slotKey)) {
                    continue;
                }
                synthetics.push({
                    id: `holiday-${slotKey}`,
                    equipmentId,
                    date,
                    timeSlotId,
                    status: 'blocked',
                    blockType: 'single',
                    blockedReason: 'Día festivo',
                    timestamp: 0,
                });
            }
        }
    }

    return [...bookings, ...synthetics];
}

function isHolidayDate(date: string, holidays: HolidayEntry[]): boolean {
    return holidays.some((holiday) => holiday.date === date);
}

const handler: Handler = async (event, context) => {
    // Respuesta para preflight CORS (peticion OPTIONS)
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: getCorsHeaders(),
            body: '',
        };
    }

    try {
        if (event.httpMethod === 'GET') {
            // GET /bookings: listar reservas
            const result = await sql`SELECT * FROM bookings ORDER BY created_at DESC`;
            const bookings = result.map((row) => snakeToCamel(row as any as DbBooking));
            const holidays = await getHolidays();
            const bookingsWithHolidayBlocks = injectHolidayBlocks(bookings, holidays);

            return {
                statusCode: 200,
                headers: getCorsHeaders(),
                body: JSON.stringify(bookingsWithHolidayBlocks),
            };
        }

        if (event.httpMethod === 'POST') {
            // POST /bookings: crear reserva
            if (!event.body) {
                return {
                    statusCode: 400,
                    headers: getCorsHeaders(),
                    body: JSON.stringify({ error: 'Missing request body' }),
                };
            }

            const booking: ApiBooking = JSON.parse(event.body);

            // Validamos campos obligatorios
            if (!booking.id || !booking.date || booking.equipmentId === undefined || !booking.timeSlotId) {
                return {
                    statusCode: 400,
                    headers: getCorsHeaders(),
                    body: JSON.stringify({ error: 'Missing required fields: id, date, equipmentId, timeSlotId' }),
                };
            }

            // Validamos que el estado este permitido
            const validStatuses = ['pending', 'approved', 'blocked'];
            if (!booking.status || !validStatuses.includes(booking.status)) {
                return {
                    statusCode: 400,
                    headers: getCorsHeaders(),
                    body: JSON.stringify({ error: 'Invalid status. Must be: pending, approved, or blocked' }),
                };
            }

            // Validamos formato de fecha
            if (!/^\d{4}-\d{2}-\d{2}$/.test(booking.date)) {
                return {
                    statusCode: 400,
                    headers: getCorsHeaders(),
                    body: JSON.stringify({ error: 'Invalid date format. Use YYYY-MM-DD' }),
                };
            }

            // Early holiday rejection: after cheap field/format validations,
            // before auth and business logic.
            const holidays = await getHolidays();
            if (isHolidayDate(booking.date, holidays)) {
                return {
                    statusCode: 400,
                    headers: getCorsHeaders(),
                    body: JSON.stringify({ error: 'No se pueden hacer reservas en días festivos.' }),
                };
            }

            // Seguridad: solo admin puede crear reservas con estados administrativos/bloqueos
            const authHeader = event.headers.authorization || event.headers.Authorization;
            const isAuthorized = await verifyAdminAuth(authHeader);

            if (!isAuthorized) {
                // Sin auth solo se acepta estado pending y sin campos de bloqueo
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

            // Timestamp generado en servidor para evitar bypass de rate limit
            booking.timestamp = Date.now();

            // Verificamos si el slot ya esta ocupado por una reserva real
            const existingBooking = await sql`SELECT * FROM bookings WHERE equipment_id = ${booking.equipmentId} AND date = ${booking.date} AND time_slot_id = ${booking.timeSlotId}`;

            if (existingBooking.length > 0) {
                const existing = existingBooking[0] as any;
                // Solo permitimos sobreescritura si era un placeholder available
                if (existing.status !== 'available') {
                    return {
                        statusCode: 409,
                        headers: getCorsHeaders(),
                        body: JSON.stringify({ error: 'Este turno ya ha sido reservado o solicitado.' }),
                    };
                }
            }

            // Aplicamos limite configurable solo para solicitudes de proxima semana
            if (booking.status === 'pending' && booking.userEmail) {
                const bookingWeekStart = formatUtcDate(getMondayUtc(parseIsoDateToUtc(booking.date)));
                const currentWeekStartDate = getMondayUtc(new Date());
                const nextWeekStartDate = new Date(currentWeekStartDate);
                nextWeekStartDate.setUTCDate(nextWeekStartDate.getUTCDate() + 7);
                const nextWeekStart = formatUtcDate(nextWeekStartDate);

                if (bookingWeekStart === nextWeekStart) {
                    const limitRow = await sql`SELECT value FROM admin_settings WHERE key = 'next_week_slots_limit'`;
                    const limitRaw = limitRow.length > 0 ? (limitRow[0] as any).value : null;
                    const parsedLimit = limitRaw ? Number.parseInt(limitRaw as string, 10) : NaN;
                    const nextWeekSlotsLimit = Number.isFinite(parsedLimit) && parsedLimit > 0
                        ? parsedLimit
                        : DEFAULT_NEXT_WEEK_SLOTS_LIMIT;

                    const nextWeekRange = getWeekRangeUtc(nextWeekStartDate);

                    const activeBookings = await sql`
                        SELECT COUNT(*) as count
                        FROM bookings
                        WHERE user_email = ${booking.userEmail}
                          AND status IN ('pending', 'approved')
                          AND date >= ${nextWeekRange.start}
                          AND date < ${nextWeekRange.endExclusive}
                    `;

                    const activeCount = parseInt((activeBookings[0] as any).count as string, 10);
                    if (activeCount >= nextWeekSlotsLimit) {
                        return {
                            statusCode: 429,
                            headers: getCorsHeaders(),
                            body: JSON.stringify({
                                error: `Límite excedido para la próxima semana. Ya tienes ${activeCount} turnos (pendientes/aprobados) para esa semana. El máximo configurado es ${nextWeekSlotsLimit}.`,
                            }),
                        };
                    }
                }
            }

            // Rate limiting: maximo de solicitudes por correo en la ultima hora (solo usuarios no admin)
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

            // Generamos codigo unico de cancelacion para el usuario (10 caracteres alfanumericos)
            const cancellationCode = !isAuthorized ? generateCancellationCode() : undefined;

            // UPSERT: inserta o actualiza cuando existe id (caso placeholders available)
            const snake = camelToSnake(booking);

            // Ya validamos conflictos arriba, por eso este UPSERT es seguro
            await sql`
        INSERT INTO bookings (id, equipment_id, date, time_slot_id, status, user_name, user_email, user_group, blocked_reason, block_type, block_start_date, block_end_date, cancellation_code, timestamp)
        VALUES (${snake.id}, ${snake.equipment_id}, ${snake.date}, ${snake.time_slot_id}, ${snake.status}, ${snake.user_name}, ${snake.user_email}, ${snake.user_group}, ${snake.blocked_reason}, ${snake.block_type}, ${snake.block_start_date}, ${snake.block_end_date}, ${cancellationCode ?? null}, ${snake.timestamp})
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
            cancellation_code = EXCLUDED.cancellation_code,
            timestamp = EXCLUDED.timestamp
      `;

            return {
                statusCode: 201,
                headers: getCorsHeaders(),
                body: JSON.stringify({ success: true, cancellationCode }),
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
