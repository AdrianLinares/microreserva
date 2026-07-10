import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { HolidayManager } from './HolidayManager';
import * as api from '../services/api';
import { COLOMBIAN_HOLIDAYS_2026, COLOMBIAN_HOLIDAYS_2027 } from '../constants';

vi.mock('../services/api', () => ({
  getHolidays: vi.fn(),
  saveHolidays: vi.fn(),
}));

describe('HolidayManager', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  async function renderHolidayManager() {
    await act(async () => {
      render(<HolidayManager />);
    });
  }

  it('renders title and zero-count badge', async () => {
    vi.mocked(api.getHolidays).mockResolvedValue([]);

    await act(async () => {
      await renderHolidayManager();
    });

    expect(screen.getByRole('heading', { name: /Gestión de Días Festivos/i })).toBeTruthy();
    expect(screen.getByText('0')).toBeTruthy();
  });

  it('loads and displays holidays on mount', async () => {
    vi.mocked(api.getHolidays).mockResolvedValue([
      { date: '2026-07-20', name: 'Independencia' },
      { date: '2026-08-07', name: 'Batalla de Boyacá' },
    ]);

    await renderHolidayManager();

    await waitFor(() => {
      expect(screen.getByText('2026-07-20 - Independencia')).toBeTruthy();
    });
    expect(screen.getByText('2026-08-07 - Batalla de Boyacá')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('shows empty state when no holidays are configured', async () => {
    vi.mocked(api.getHolidays).mockResolvedValue([]);

    await renderHolidayManager();

    await waitFor(() => {
      expect(screen.getByText(/No hay días festivos configurados/i)).toBeTruthy();
    });
  });

  it('adds a holiday manually and validates required fields', async () => {
    vi.mocked(api.getHolidays).mockResolvedValue([]);
    await renderHolidayManager();
    await waitFor(() => screen.getByText(/No hay días festivos configurados/i));

    const addButton = screen.getByRole('button', { name: /Agregar/i });
    fireEvent.click(addButton);
    expect(screen.getByText(/Seleccione una fecha/i)).toBeTruthy();

    const dateInput = screen.getByLabelText(/Fecha/i);
    const nameInput = screen.getByLabelText(/Nombre/i);

    fireEvent.change(dateInput, { target: { value: '2026-12-08' } });
    fireEvent.click(addButton);
    expect(screen.getByText(/Ingrese un nombre/i)).toBeTruthy();

    fireEvent.change(nameInput, { target: { value: 'Inmaculada Concepción' } });
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByText('2026-12-08 - Inmaculada Concepción')).toBeTruthy();
    });
  });

  it('rejects duplicate holiday dates', async () => {
    vi.mocked(api.getHolidays).mockResolvedValue([{ date: '2026-12-08', name: 'Inmaculada' }]);
    await renderHolidayManager();
    await waitFor(() => screen.getByText('2026-12-08 - Inmaculada'));

    fireEvent.change(screen.getByLabelText(/Fecha/i), { target: { value: '2026-12-08' } });
    fireEvent.change(screen.getByLabelText(/Nombre/i), { target: { value: 'Otro nombre' } });
    fireEvent.click(screen.getByRole('button', { name: /Agregar/i }));

    expect(screen.getByText(/La fecha ya existe/i)).toBeTruthy();
  });

  it('removes a holiday from the list', async () => {
    vi.mocked(api.getHolidays).mockResolvedValue([{ date: '2026-12-08', name: 'Inmaculada' }]);
    await renderHolidayManager();
    await waitFor(() => screen.getByText('2026-12-08 - Inmaculada'));

    fireEvent.click(screen.getByRole('button', { name: /Eliminar/i }));

    await waitFor(() => {
      expect(screen.queryByText('2026-12-08 - Inmaculada')).toBeNull();
    });
    expect(screen.getByText('0')).toBeTruthy();
  });

  it('preloads 2026 holidays without overwriting existing entries', async () => {
    vi.mocked(api.getHolidays).mockResolvedValue([{ date: '2026-05-01', name: 'Día del Trabajo' }]);
    await renderHolidayManager();
    await waitFor(() => screen.getByText('2026-05-01 - Día del Trabajo'));

    fireEvent.click(screen.getByRole('button', { name: /Precargar 2026/i }));

    await waitFor(() => {
      expect(screen.getByText(String(COLOMBIAN_HOLIDAYS_2026.length))).toBeTruthy();
    });
    expect(screen.getByText('2026-05-01 - Día del Trabajo')).toBeTruthy();
    expect(screen.getByText('2026-01-01 - Año Nuevo')).toBeTruthy();
  });

  it('preloads 2027 holidays merging with existing list', async () => {
    vi.mocked(api.getHolidays).mockResolvedValue([]);
    await renderHolidayManager();
    await waitFor(() => screen.getByText(/No hay días festivos configurados/i));

    fireEvent.click(screen.getByRole('button', { name: /Precargar 2026/i }));
    await waitFor(() => expect(screen.getByText(String(COLOMBIAN_HOLIDAYS_2026.length))).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: /Precargar 2027/i }));
    await waitFor(() => {
      expect(screen.getByText(String(COLOMBIAN_HOLIDAYS_2026.length + COLOMBIAN_HOLIDAYS_2027.length))).toBeTruthy();
    });
  });

  it('saves holidays through the API and shows success feedback', async () => {
    vi.mocked(api.getHolidays).mockResolvedValue([]);
    vi.mocked(api.saveHolidays).mockResolvedValue(undefined);
    await renderHolidayManager();
    await waitFor(() => screen.getByText(/No hay días festivos configurados/i));

    fireEvent.change(screen.getByLabelText(/Fecha/i), { target: { value: '2026-12-08' } });
    fireEvent.change(screen.getByLabelText(/Nombre/i), { target: { value: 'Inmaculada Concepción' } });
    fireEvent.click(screen.getByRole('button', { name: /Agregar/i }));
    await waitFor(() => screen.getByText('2026-12-08 - Inmaculada Concepción'));

    fireEvent.click(screen.getByRole('button', { name: /Guardar Cambios/i }));

    await waitFor(() => {
      expect(screen.getByText(/Días festivos guardados/i)).toBeTruthy();
    });
    expect(api.saveHolidays).toHaveBeenCalledWith([{ date: '2026-12-08', name: 'Inmaculada Concepción' }]);
  });

  it('shows error feedback when save fails', async () => {
    vi.mocked(api.getHolidays).mockResolvedValue([{ date: '2026-12-08', name: 'Inmaculada' }]);
    vi.mocked(api.saveHolidays).mockRejectedValue(new Error('Network error'));
    await renderHolidayManager();
    await waitFor(() => screen.getByText('2026-12-08 - Inmaculada'));

    fireEvent.click(screen.getByRole('button', { name: /Guardar Cambios/i }));

    await waitFor(() => {
      expect(screen.getByText(/Network error/i)).toBeTruthy();
    });
  });

  it('toggles section visibility', async () => {
    vi.mocked(api.getHolidays).mockResolvedValue([]);
    await renderHolidayManager();
    const toggle = screen.getByRole('button', { name: /Gestión de Días Festivos/i });

    fireEvent.click(toggle);
    expect(screen.queryByText(/No hay días festivos configurados/i)).toBeNull();

    fireEvent.click(toggle);
    await waitFor(() => {
      expect(screen.getByText(/No hay días festivos configurados/i)).toBeTruthy();
    });
  });
});
