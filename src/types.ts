export interface Equipment {
    id: number;
    name: string;
    description: string;
    type: 'Microscopio' | 'Estereomicroscopio';
    brand: 'ZEISS' | 'OLYMPUS';
    hasCamera: boolean;
}

export type BookingStatus = 'available' | 'pending' | 'approved' | 'blocked';

export interface TimeSlot {
    id: string; // e.g., "08:00"
    label: string; // "8:00 - 9:00 AM"
    startHour: number;
}

export interface Booking {
    id: string;
    equipmentId: number;
    date: string; // ISO Date string (YYYY-MM-DD)
    timeSlotId: string;
    status: BookingStatus;

    // User Data
    userName?: string;
    userEmail?: string;
    userGroup?: string;

    // Admin Data - Bloqueo
    blockedReason?: string;
    blockType?: 'single' | 'range' | 'indefinite'; // single date, date range, or indefinite
    blockStartDate?: string; // For range and indefinite blocks
    blockEndDate?: string; // For range blocks only

    timestamp: number;
}

export interface DayConfig {
    date: Date;
    label: string; // "Lunes", "Martes", etc.
}

export interface User {
    email: string;
    isAdmin: boolean;
}
