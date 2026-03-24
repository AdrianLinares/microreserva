import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import App from './App';
import * as api from './services/api';

vi.mock('./services/api', async (importOriginal) => {
    const actual = await importOriginal<typeof import('./services/api')>();
    return {
        ...actual,
        getPublicSettings: vi.fn().mockResolvedValue({ adminEmail: 'admin@sgc.gov.co' }),
        getBookings: vi.fn().mockResolvedValue([]),
    };
});

describe('App Component', () => {
    it('renders without crashing', async () => {
        render(<App />);
        expect(await screen.findByText(/Sistema de Reserva/i)).toBeInTheDocument();
    });
});

