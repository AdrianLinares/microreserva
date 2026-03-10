import { Booking, BookingStatus } from '../types';

const API_URL = (import.meta as any).env.VITE_API_URL || '/.netlify/functions';
const ADMIN_TOKEN_KEY = 'micro_admin_token';

/**
 * Guarda credenciales admin en sessionStorage como base64(username:password).
 * Esto evita pedir login en cada accion del panel durante la misma sesion.
 */
export function saveAdminCredentials(username: string, password: string): void {
    const credentials = `${username}:${password}`;
    const base64 = btoa(credentials);
    sessionStorage.setItem(ADMIN_TOKEN_KEY, base64);
}

/**
 * Elimina credenciales admin de sessionStorage.
 */
export function clearAdminCredentials(): void {
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
}

/**
 * Construye el header Authorization a partir del token guardado.
 */
function getAuthHeader(): string | undefined {
    const token = sessionStorage.getItem(ADMIN_TOKEN_KEY);
    if (!token) return undefined;
    return `Basic ${token}`;
}

/**
 * Helper HTTP generico para centralizar:
 * - manejo de headers
 * - auth opcional
 * - mensajes de error consistentes
 */
async function request<T>(
    path: string,
    options: RequestInit = {},
    requireAuth: boolean = false
): Promise<T> {
    const url = `${API_URL}${path}`;

    const baseHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
    };

    if (requireAuth) {
        const authHeader = getAuthHeader();
        if (!authHeader) {
            throw new Error('Admin credentials not found');
        }
        baseHeaders.Authorization = authHeader;
    }

    const optionHeaders = (options.headers || {}) as Record<string, string>;
    const headers = {
        ...baseHeaders,
        ...optionHeaders,
    };

    const response = await fetch(url, {
        ...options,
        cache: options.cache ?? (options.method === 'GET' || !options.method ? 'no-store' : undefined),
        headers,
    });

    if (!response.ok) {
        let errorMessage = `API error: ${response.status} ${response.statusText}`;
        try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
        } catch (e) {
            // Si el backend no devuelve JSON, usamos texto plano como fallback
            const text = await response.text();
            if (text) {
                errorMessage = text.substring(0, 200);
            }
        }
        throw new Error(errorMessage);
    }

    return response.json();
}

/**
 * Obtiene todas las reservas.
 * Agregamos timestamp para evitar respuesta en cache del navegador/proxy.
 */
export async function getBookings(): Promise<Booking[]> {
    return request<Booking[]>(`/bookings?t=${Date.now()}`, {
        method: 'GET',
        cache: 'no-store',
    });
}

/**
 * Crea una reserva nueva.
 */
export async function addBooking(booking: Booking): Promise<void> {
    await request('/bookings', {
        method: 'POST',
        body: JSON.stringify(booking),
    });
}

/**
 * Actualiza solo estado de una reserva (approved/pending/blocked/available).
 */
export async function updateBookingStatus(
    id: string,
    status: BookingStatus,
    extra?: Partial<Booking>
): Promise<void> {
    const payload: any = { status };
    if (extra) {
        Object.assign(payload, extra);
    }

    await request(`/booking?id=${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
        headers: {
            'Content-Type': 'application/json',
        },
    }, true);
}

/**
 * Mueve una reserva a otro slot (fecha/equipo/horario).
 */
export async function updateBookingDetails(
    oldId: string,
    newDetails: {
        date: string;
        equipmentId: number;
        timeSlotId: string;
    }
): Promise<{ newId?: string }> {
    return request(
        `/booking?id=${encodeURIComponent(oldId)}`,
        {
            method: 'PUT',
            body: JSON.stringify(newDetails),
        },
        true
    );
}

/**
 * Elimina una reserva por id.
 */
export async function deleteBooking(id: string): Promise<void> {
    await request(`/booking?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
    }, true);
}

/**
 * Intercambia los slots entre dos reservas.
 */
export async function swapBookingSlots(firstId: string, secondId: string): Promise<void> {
    await request('/bookings-swap', {
        method: 'POST',
        body: JSON.stringify({ firstId, secondId }),
    }, true);
}

export interface PublicAdminSettings {
    nextWeekSlotsLimit: number;
}

export interface AdminSettings extends PublicAdminSettings {
    notificationEmail: string;
}

/**
 * Lee configuracion completa del panel admin (requiere autenticacion).
 */
export async function getAdminSettings(): Promise<AdminSettings> {
    return request('/settings', { method: 'GET' }, true);
}

/**
 * Lee configuracion publica (sin autenticacion), usada por la UI de usuarios.
 */
export async function getPublicSettings(): Promise<PublicAdminSettings> {
    return request('/settings', { method: 'GET' });
}

/**
 * Guarda configuracion del panel admin.
 */
export async function saveAdminSettings(settings: { notificationEmail?: string; nextWeekSlotsLimit?: number }): Promise<void> {
    await request('/settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
    }, true);
}

/**
 * Devuelve el lunes de la semana de una fecha dada.
 * Se usa para calcular ventanas semanales de manera consistente.
 */
export function getMondayOfCurrentWeek(d: Date): Date {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    date.setDate(diff);
    date.setHours(0, 0, 0, 0);
    return date;
}

/**
 * Genera los dias laborales (lunes a viernes) de la semana solicitada.
 */
export function generateWeekDays(weekOffset: number = 0): Date[] {
    const today = new Date();
    const monday = getMondayOfCurrentWeek(today);

    // weekOffset=1 significa proxima semana, por eso sumamos bloques de 7 dias
    monday.setDate(monday.getDate() + weekOffset * 7);

    const days = [];
    for (let i = 0; i < 5; i++) {
        const nextDay = new Date(monday);
        nextDay.setDate(monday.getDate() + i);
        days.push(nextDay);
    }
    return days;
}
