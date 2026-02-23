import { Booking, BookingStatus } from '../types';

const API_URL = (import.meta as any).env.VITE_API_URL || '/.netlify/functions';
const ADMIN_TOKEN_KEY = 'petro_admin_token';

/**
 * Save admin credentials to sessionStorage as base64(username:password)
 */
export function saveAdminCredentials(username: string, password: string): void {
    const credentials = `${username}:${password}`;
    const base64 = btoa(credentials);
    sessionStorage.setItem(ADMIN_TOKEN_KEY, base64);
}

/**
 * Clear admin credentials from sessionStorage
 */
export function clearAdminCredentials(): void {
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
}

/**
 * Get Authorization header from sessionStorage
 */
function getAuthHeader(): string | undefined {
    const token = sessionStorage.getItem(ADMIN_TOKEN_KEY);
    if (!token) return undefined;
    return `Basic ${token}`;
}

/**
 * Generic HTTP request helper
 */
async function request<T>(
    path: string,
    options: RequestInit = {},
    requireAuth: boolean = false
): Promise<T> {
    const url = `${API_URL}${path}`;

    const headers: any = {
        'Content-Type': 'application/json',
    };

    if (requireAuth) {
        const authHeader = getAuthHeader();
        if (!authHeader) {
            throw new Error('Admin credentials not found');
        }
        headers.Authorization = authHeader;
    }

    const response = await fetch(url, {
        ...options,
        headers,
    });

    if (!response.ok) {
        let errorMessage = `API error: ${response.status} ${response.statusText}`;
        try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
        } catch (e) {
            // Response body is not JSON, use status message
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
 * Get all bookings from the server
 */
export async function getBookings(): Promise<Booking[]> {
    return request<Booking[]>('/bookings', { method: 'GET' });
}

/**
 * Add a new booking
 */
export async function addBooking(booking: Booking): Promise<void> {
    await request('/bookings', {
        method: 'POST',
        body: JSON.stringify(booking),
    });
}

/**
 * Update booking status
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

    await request('/booking', {
        method: 'PUT',
        body: JSON.stringify(payload),
        headers: {
            'Content-Type': 'application/json',
        },
    }, true);
}

/**
 * Update booking details (date, equipmentId, timeSlotId)
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
 * Delete a booking
 */
export async function deleteBooking(id: string): Promise<void> {
    await request(`/booking?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
    }, true);
}

/**
 * Swap two booking slots
 */
export async function swapBookingSlots(firstId: string, secondId: string): Promise<void> {
    await request('/bookings-swap', {
        method: 'POST',
        body: JSON.stringify({ firstId, secondId }),
    }, true);
}

/**
 * Get admin settings
 */
export async function getAdminSettings(): Promise<{ notificationEmail: string }> {
    return request('/settings', { method: 'GET' }, true);
}

/**
 * Save admin settings
 */
export async function saveAdminSettings(settings: { notificationEmail: string }): Promise<void> {
    await request('/settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
    }, true);
}

/**
 * Get Monday of the current week
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
 * Generate week days starting from Monday
 */
export function generateWeekDays(weekOffset: number = 0): Date[] {
    const today = new Date();
    const monday = getMondayOfCurrentWeek(today);

    // Add offset weeks (7 days * offset)
    monday.setDate(monday.getDate() + weekOffset * 7);

    const days = [];
    for (let i = 0; i < 5; i++) {
        const nextDay = new Date(monday);
        nextDay.setDate(monday.getDate() + i);
        days.push(nextDay);
    }
    return days;
}
