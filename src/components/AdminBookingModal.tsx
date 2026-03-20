import React, { useState } from 'react';
import { X } from 'lucide-react';
import { EQUIPMENT_LIST } from '../constants';

interface AdminBookingModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: { name: string; email: string; group: string; slots: Array<{ date: string; equipmentId: number; timeSlotId: string }> }) => void;
    selectedSlots: Array<{ date: string; equipmentId: number; timeSlotId: string }>;
    isLoading?: boolean;
}

const AdminBookingModal: React.FC<AdminBookingModalProps> = ({
    isOpen,
    onClose,
    onSubmit,
    selectedSlots,
    isLoading = false
}) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [group, setGroup] = useState('');
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleClose = () => {
        setName('');
        setEmail('');
        setGroup('');
        setError('');
        onClose();
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!name.trim() || !email.trim() || !group.trim()) {
            setError('Todos los campos son obligatorios.');
            return;
        }

        if (!email.includes('@')) {
            setError('Por favor ingrese un correo electrónico válido.');
            return;
        }

        if (selectedSlots.length === 0) {
            setError('Debe seleccionar al menos un turno.');
            return;
        }

        onSubmit({ name, email, group, slots: selectedSlots });
        setName('');
        setEmail('');
        setGroup('');
    };

    const inputClasses = "w-full px-3 py-2 bg-white border border-slate-300 rounded text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-slate-400";

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md animate-fade-in">
                <div className="flex justify-between items-center p-6 border-b border-slate-100">
                    <h2 className="text-lg font-bold text-slate-800">Crear Solicitud de Reserva</h2>
                    <button
                        type="button"
                        onClick={handleClose}
                        disabled={isLoading}
                        className="text-slate-400 hover:text-slate-600"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error && (
                        <div className="bg-red-50 text-red-600 p-3 rounded text-sm border border-red-200">
                            {error}
                        </div>
                    )}

                    {selectedSlots.length > 0 && (
                        <div className="bg-blue-50 p-3 rounded text-sm border border-blue-200">
                            <p className="font-semibold text-blue-900 mb-2">Turnos seleccionados: {selectedSlots.length}</p>
                            <ul className="space-y-1 text-blue-800 text-xs">
                                {selectedSlots.map((slot, idx) => {
                                    const equipment = EQUIPMENT_LIST.find(e => e.id === slot.equipmentId);
                                    return (
                                        <li key={idx}>
                                            {slot.date} - {equipment?.name || `Equipo ${slot.equipmentId}`}
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Nombre Completo</label>
                        <input
                            type="text"
                            className={inputClasses}
                            placeholder="Juan Pérez"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            disabled={isLoading}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Correo Electrónico</label>
                        <input
                            type="email"
                            className={inputClasses}
                            placeholder="juan@sgc.gov.co"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={isLoading}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Grupo de Trabajo</label>
                        <input
                            type="text"
                            className={inputClasses}
                            placeholder="Cartografía"
                            value={group}
                            onChange={(e) => setGroup(e.target.value)}
                            disabled={isLoading}
                        />
                    </div>

                    <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={handleClose}
                            disabled={isLoading}
                            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded transition-colors disabled:opacity-50"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50 font-medium"
                        >
                            {isLoading ? 'Creando...' : 'Crear Solicitud'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AdminBookingModal;
