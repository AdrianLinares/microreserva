export interface Equipment {
    id: number;
    name: string;
    description: string;
    type: 'Microscopio' | 'Estereomicroscopio';
    brand: 'ZEISS' | 'OLYMPUS';
    obj: 'obj 2.5x, 4x, 10x, 20x, 50x, 100x' | 'obj 4x, 10x, 20x, 100x' | 'obj 0.63x, 1x, 1.5x';
    hasCamera: boolean;
}

export type BookingStatus = 'available' | 'pending' | 'approved' | 'blocked';

export interface TimeSlot {
    id: string; // Clave interna del turno, por ejemplo "08:00"
    label: string; // Texto que se muestra en la UI, por ejemplo "8:00 - 9:00 AM"
    startHour: number;
}

export interface Booking {
    id: string;
    equipmentId: number;
    date: string; // Fecha en formato ISO corto: YYYY-MM-DD
    timeSlotId: string;
    status: BookingStatus;

    // Datos de quien solicita el turno
    userName?: string;
    userEmail?: string;
    userGroup?: string;

    // Campos que usa administracion para bloqueos
    blockedReason?: string;
    blockType?: 'slot' | 'single' | 'range' | 'indefinite'; // Turno individual, un dia, rango de fechas o bloqueo hasta desbloqueo manual
    blockStartDate?: string; // Fecha inicial para bloqueos por rango o indefinidos
    blockEndDate?: string; // Fecha final solo para bloqueos por rango

    timestamp: number;
}

export interface DayConfig {
    date: Date;
    label: string; // Etiqueta legible en calendario: "Lunes", "Martes", etc.
}

export interface User {
    email: string;
    isAdmin: boolean;
}
