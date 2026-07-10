import { Equipment, HolidayEntry, TimeSlot } from './types';

export const EQUIPMENT_LIST: Equipment[] = [
    { id: 1, name: 'MESA No. 1', description: 'ESTEREOMICROSCOPIO ZEISS (con Cámara)', type: 'Estereomicroscopio', brand: 'ZEISS', obj: 'obj 0.63x, 1x, 1.5x', hasCamera: true },
    { id: 2, name: 'MESA No. 2', description: 'MICROSCOPIO ZEISS (con Cámara)', type: 'Microscopio', brand: 'ZEISS', obj: 'obj 2.5x, 4x, 10x, 20x, 50x, 100x', hasCamera: true },
    { id: 3, name: 'MESA No. 3', description: 'ESTEREOMICROSCOPIO ZEISS (con Cámara)', type: 'Estereomicroscopio', brand: 'ZEISS', obj: 'obj 0.63x, 1x, 1.5x', hasCamera: true },
    { id: 4, name: 'MESA No. 4', description: 'MICROSCOPIO OLYMPUS (con Cámara)', type: 'Microscopio', brand: 'OLYMPUS', obj: 'obj 2.5x, 4x, 10x, 20x, 50x, 100x', hasCamera: true },
    { id: 5, name: 'MESA No. 5', description: 'MICROSCOPIO OLYMPUS (con Cámara)', type: 'Microscopio', brand: 'OLYMPUS', obj: 'obj 2.5x, 4x, 10x, 20x, 50x, 100x', hasCamera: true },
    { id: 6, name: 'MESA No. 6', description: 'MICROSCOPIO OLYMPUS (con Cámara)', type: 'Microscopio', brand: 'OLYMPUS', obj: 'obj 2.5x, 4x, 10x, 20x, 50x, 100x', hasCamera: true },
    { id: 7, name: 'MESA No. 7', description: 'ESTEREOMICROSCOPIO ZEISS (sin Cámara)', type: 'Estereomicroscopio', brand: 'ZEISS', obj: 'obj 0.63x, 1x, 1.5x', hasCamera: false },
    { id: 8, name: 'MESA No. 8', description: 'MICROSCOPIO OLYMPUS (con Cámara)', type: 'Microscopio', brand: 'OLYMPUS', obj: 'obj 4x, 10x, 20x, 100x', hasCamera: true },
];

export const TIME_SLOTS: TimeSlot[] = [
    { id: '08:00', label: '8:00 AM - 12:00 PM', startHour: 8 },
    { id: '12:00', label: '12:00 PM - 4:00 PM', startHour: 13 },
];

export const COLOMBIAN_HOLIDAYS_2026: HolidayEntry[] = [
    { date: '2026-01-01', name: 'Año Nuevo' },
    { date: '2026-01-12', name: 'Día de los Reyes Magos' },
    { date: '2026-03-23', name: 'Día de San José' },
    { date: '2026-04-02', name: 'Jueves Santo' },
    { date: '2026-04-03', name: 'Viernes Santo' },
    { date: '2026-04-05', name: 'Domingo de Resurrección' },
    { date: '2026-05-01', name: 'Día del Trabajo' },
    { date: '2026-05-18', name: 'Ascensión del Señor' },
    { date: '2026-06-08', name: 'Corpus Christi' },
    { date: '2026-06-15', name: 'Sagrado Corazón de Jesús' },
    { date: '2026-06-29', name: 'San Pedro y San Pablo' },
    { date: '2026-07-20', name: 'Día de la Independencia' },
    { date: '2026-08-07', name: 'Batalla de Boyacá' },
    { date: '2026-08-17', name: 'Asunción de la Virgen' },
    { date: '2026-10-12', name: 'Día de la Raza' },
    { date: '2026-11-02', name: 'Día de Todos los Santos' },
    { date: '2026-11-11', name: 'Independencia de Cartagena' },
    { date: '2026-12-08', name: 'Inmaculada Concepción' },
    { date: '2026-12-25', name: 'Navidad' },
];

export const COLOMBIAN_HOLIDAYS_2027: HolidayEntry[] = [
    { date: '2027-01-01', name: 'Año Nuevo' },
    { date: '2027-01-11', name: 'Día de los Reyes Magos' },
    { date: '2027-03-22', name: 'Día de San José' },
    { date: '2027-03-25', name: 'Jueves Santo' },
    { date: '2027-03-26', name: 'Viernes Santo' },
    { date: '2027-03-28', name: 'Domingo de Resurrección' },
    { date: '2027-05-01', name: 'Día del Trabajo' },
    { date: '2027-05-10', name: 'Ascensión del Señor' },
    { date: '2027-05-31', name: 'Corpus Christi' },
    { date: '2027-06-07', name: 'Sagrado Corazón de Jesús' },
    { date: '2027-07-05', name: 'San Pedro y San Pablo' },
    { date: '2027-07-20', name: 'Día de la Independencia' },
    { date: '2027-08-07', name: 'Batalla de Boyacá' },
    { date: '2027-08-16', name: 'Asunción de la Virgen' },
    { date: '2027-10-18', name: 'Día de la Raza' },
    { date: '2027-11-01', name: 'Día de Todos los Santos' },
    { date: '2027-11-11', name: 'Independencia de Cartagena' },
    { date: '2027-12-08', name: 'Inmaculada Concepción' },
    { date: '2027-12-25', name: 'Navidad' },
];
