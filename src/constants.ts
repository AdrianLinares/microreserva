import { Equipment, TimeSlot } from './types';

export const MAX_SLOTS_PER_PERSON = 6;

export const EQUIPMENT_LIST: Equipment[] = [
    { id: 1, name: 'MESA No. 1', description: 'ESTEREOMICROSCOPIO ZEISS (con Cámara)', type: 'Estereomicroscopio', brand: 'ZEISS', hasCamera: true },
    { id: 2, name: 'MESA No. 2', description: 'MICROSCOPIO ZEISS (con Cámara)', type: 'Microscopio', brand: 'ZEISS', hasCamera: true },
    { id: 3, name: 'MESA No. 3', description: 'ESTEREOMICROSCOPIO ZEISS (con Cámara)', type: 'Estereomicroscopio', brand: 'ZEISS', hasCamera: true },
    { id: 4, name: 'MESA No. 4', description: 'MICROSCOPIO OLYMPUS (con Cámara)', type: 'Microscopio', brand: 'OLYMPUS', hasCamera: true },
    { id: 5, name: 'MESA No. 5', description: 'MICROSCOPIO OLYMPUS (con Cámara)', type: 'Microscopio', brand: 'OLYMPUS', hasCamera: true },
    { id: 6, name: 'MESA No. 6', description: 'MICROSCOPIO OLYMPUS (con Cámara)', type: 'Microscopio', brand: 'OLYMPUS', hasCamera: true },
    { id: 7, name: 'MESA No. 7', description: 'ESTEREOMICROSCOPIO ZEISS (sin Cámara)', type: 'Estereomicroscopio', brand: 'ZEISS', hasCamera: false },
    { id: 8, name: 'MESA No. 8', description: 'MICROSCOPIO OLYMPUS (con Cámara)', type: 'Microscopio', brand: 'OLYMPUS', hasCamera: true },
];

export const TIME_SLOTS: TimeSlot[] = [
    { id: '08:00', label: '8:00 AM - 12:00 PM', startHour: 8 },
    { id: '12:00', label: '1:00 PM - 4:00 PM', startHour: 13 },
];

export const ADMIN_CREDENTIALS = {
    username: 'admin',
    password: 'password123' // Simple mock auth
};

export const MOCK_ADMIN_EMAIL = "admin@geociencias.gov";
