import { render, screen, fireEvent } from '@testing-library/react';
import BookingModal from './BookingModal';
import { Equipment } from '../types';

describe('BookingModal Component', () => {
    const mockOnClose = vi.fn();
    const mockOnSubmit = vi.fn();
    const sampleEquipment: Equipment = {
        id: '1',
        name: 'Microscopio 1',
        description: 'Petrográfico',
        status: 'active'
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('no renderiza cuando isOpen es false', () => {
        render(
            <BookingModal
                isOpen={false}
                onClose={mockOnClose}
                onSubmit={mockOnSubmit}
                selectedCount={1}
            />
        );
        expect(screen.queryByText(/Confirmar Solicitud/i)).not.toBeInTheDocument();
    });

    it('renderiza correctamente cuando isOpen es true', () => {
        render(
            <BookingModal
                isOpen={true}
                onClose={mockOnClose}
                onSubmit={mockOnSubmit}
                selectedCount={2}
                sampleEquipment={sampleEquipment}
            />
        );

        expect(screen.getByText(/Confirmar Solicitud/i)).toBeInTheDocument();
        expect(screen.getByText(/2/)).toBeInTheDocument();
        expect(screen.getByText(/Ejemplo de equipo: Microscopio 1/i)).toBeInTheDocument();
    });

    it('muestra error si hay campos vacíos al enviar', () => {
        render(
            <BookingModal
                isOpen={true}
                onClose={mockOnClose}
                onSubmit={mockOnSubmit}
                selectedCount={1}
            />
        );

        const submitButton = screen.getByRole('button', { name: /Solicitar Turno/i });
        fireEvent.click(submitButton);

        expect(screen.getByText(/Todos los campos son obligatorios/i)).toBeInTheDocument();
        expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('llama a onSubmit con los datos correctos si los campos son válidos', () => {
        render(
            <BookingModal
                isOpen={true}
                onClose={mockOnClose}
                onSubmit={mockOnSubmit}
                selectedCount={1}
            />
        );

        fireEvent.change(screen.getByPlaceholderText('Juan Pérez'), { target: { value: 'Test User' } });
        fireEvent.change(screen.getByPlaceholderText('juan@sgc.gov.co'), { target: { value: 'test@sgc.gov.co' } });
        fireEvent.change(screen.getByPlaceholderText('Cartografía'), { target: { value: 'Grupo Geología' } });

        fireEvent.click(screen.getByRole('button', { name: /Solicitar Turno/i }));

        expect(mockOnSubmit).toHaveBeenCalledWith({
            name: 'Test User',
            email: 'test@sgc.gov.co',
            group: 'Grupo Geología'
        });
    });

    it('llama a onClose al hacer click en Cancelar', () => {
        render(
            <BookingModal
                isOpen={true}
                onClose={mockOnClose}
                onSubmit={mockOnSubmit}
                selectedCount={1}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: /Cancelar/i }));
        expect(mockOnClose).toHaveBeenCalled();
    });
});
