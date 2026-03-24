import { render, screen } from '@testing-library/react';
import AdminPanel from './AdminPanel';
import * as api from '../services/api';
import { vi } from 'vitest';

vi.mock('../services/api', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../services/api')>();
    return {
        ...actual,
        updateBookingStatus: vi.fn(),
        getAdminSettings: vi.fn().mockResolvedValue({ defaultNotificationEmail: 'test@sgc.gov.co', nextWeekSlotsLimit: 6 }),
    };
});

describe('AdminPanel Component', () => {
    const mockRefreshData = vi.fn().mockResolvedValue(undefined);
    const mockOnLogout = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renderiza correctamente el panel con la lista de reservas', async () => {
        const mockBookings = [
            { id: '1', equipmentId: 'eq1', userId: 'usr1', startTime: '08:00', endTime: '09:00', date: '2023-10-15', status: 'pending', userName: 'Test User', userEmail: 'test@test.com', userGroup: 'Group', isRead: false }
        ];

        render(
            <AdminPanel
                bookings={mockBookings as any}
                refreshData={mockRefreshData}
                onLogout={mockOnLogout}
            />
        );

        expect(await screen.findByText(/Panel de Administrador/i)).toBeInTheDocument();
        expect(screen.getByText(/Solicitudes Pendientes/i)).toBeInTheDocument();
        expect(screen.getByText('Test User')).toBeInTheDocument();
    });
});

