import React, { useState } from 'react';
import { Equipment, TimeSlot } from '../types';

interface BookingModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: { name: string; email: string; group: string }) => void;
    selectedCount: number;
    sampleEquipment?: Equipment; // Just for display context
}

const BookingModal: React.FC<BookingModalProps> = ({
    isOpen,
    onClose,
    onSubmit,
    selectedCount,
    sampleEquipment
}) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [group, setGroup] = useState('');
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleClose = () => {
        // Reset form when closing
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

        onSubmit({ name, email, group });
        // Reset form
        setName('');
        setEmail('');
        setGroup('');
    };

    const inputClasses = "w-full px-3 py-2 bg-white border border-slate-300 rounded text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-slate-400";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md animate-fade-in">
                <div className="p-6 border-b border-gray-100">
                    <h2 className="text-xl font-bold text-slate-800">Confirmar Solicitud</h2>
                    <p className="text-sm text-slate-500 mt-1">
                        Estás solicitando <span className="font-semibold text-blue-600">{selectedCount}</span> turno(s).
                    </p>
                    {sampleEquipment && (
                        <p className="text-xs text-slate-400 mt-2">
                            Ejemplo de equipo: {sampleEquipment.name} - {sampleEquipment.description}
                        </p>
                    )}
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error && (
                        <div className="bg-red-50 text-red-600 p-3 rounded text-sm border border-red-200">
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Nombre Completo</label>
                        <input
                            type="text"
                            className={inputClasses}
                            placeholder="Juan Pérez"
                            name="fullname"
                            autoComplete="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Correo Electrónico</label>
                        <input
                            type="email"
                            className={inputClasses}
                            placeholder="juan@sgc.gov.co"
                            name="email"
                            autoComplete="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Grupo de Trabajo</label>
                        <input
                            type="text"
                            className={inputClasses}
                            placeholder="Cartografía"
                            name="group"
                            autoComplete="organization"
                            value={group}
                            onChange={(e) => setGroup(e.target.value)}
                        />
                    </div>

                    <div className="flex justify-end gap-3 mt-6">
                        <button
                            type="button"
                            onClick={handleClose}
                            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors shadow-sm"
                        >
                            Solicitar Turno
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default BookingModal;
