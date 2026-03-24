import { vi, describe, it, expect, beforeEach } from 'vitest';
import { getBookings, addBooking, generateWeekDays } from './api';
import { Booking } from '../types';

global.fetch = vi.fn();

describe('API Services', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('generateWeekDays', () => {
        it('debe generar 5 dias laborales (lunes a viernes)', () => {
            const days = generateWeekDays(0);
            expect(days).toHaveLength(5);
            expect(days[0].getDay()).toBe(1); // Lunes
            expect(days[4].getDay()).toBe(5); // Viernes
        });
    });

    describe('getBookings', () => {
        it('debe retornar una lista de reservas', async () => {
            const mockBookings: Booking[] = [
                { id: '1', equipmentId: 'eq1', userId: 'user1', startTime: '08:00', endTime: '09:00', date: '2023-10-15', status: 'pending', userName: 'Test', userEmail: 'test@a.co', userGroup: 'group', isRead: false },
            ];

            const mockResponse = new Response(JSON.stringify(mockBookings), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
            (fetch as any).mockResolvedValue(mockResponse);

            const result = await getBookings();
            expect(result).toEqual(mockBookings);
            expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/bookings'), expect.objectContaining({
                method: 'GET'
            }));
        });

        it('debe arrojar error si la respuesta no es ok', async () => {
            const mockResponse = new Response('Error del servidor', {
                status: 500,
                statusText: 'Internal Server Error'
            });
            (fetch as any).mockResolvedValue(mockResponse);

            await expect(getBookings()).rejects.toThrow();
        });
    });

    describe('addBooking', () => {
        it('debe agregar una nueva reserva correctamente', async () => {
            const newBookingData: Partial<Booking> = {
                equipmentId: 'eq1',
                userName: 'Test User',
                userEmail: 'test@sgc.gov.co',
                userGroup: 'Geología',
                date: '2023-10-15',
                timeSlot: '08:00 - 10:00',
                status: 'pending' // Importante para evitar auth de admin
            };

            const expectedResponse = { id: 'new-id', ...newBookingData };

            const mockResponse = new Response(JSON.stringify(expectedResponse), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
            (fetch as any).mockResolvedValue(mockResponse);

            // Validamos que devuelva resolve vacio ya que Promise<void> usualmente maneja respuesta y retorna
            await expect(addBooking(newBookingData as any)).resolves.not.toThrow();
            expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/bookings'), expect.objectContaining({
                method: 'POST',
                headers: expect.objectContaining({ 'Content-Type': 'application/json' })
            }));
        });
    });
});
