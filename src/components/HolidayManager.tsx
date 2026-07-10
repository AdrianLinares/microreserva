import React, { useEffect, useMemo, useState } from 'react';
import { HolidayEntry } from '../types';
import { COLOMBIAN_HOLIDAYS_2026, COLOMBIAN_HOLIDAYS_2027 } from '../constants';
import { getHolidays, saveHolidays } from '../services/api';
import { Calendar, Flag, X } from 'lucide-react';

const inputClasses = "w-full px-3 py-2 bg-white border border-slate-300 rounded text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-slate-400";

export const HolidayManager: React.FC = () => {
    const [holidays, setHolidays] = useState<HolidayEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [newDate, setNewDate] = useState('');
    const [newName, setNewName] = useState('');
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [collapsed, setCollapsed] = useState(false);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        getHolidays()
            .then((loaded) => {
                if (!cancelled) setHolidays(loaded);
            })
            .catch((error) => {
                if (!cancelled) setFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Error al cargar' });
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => { cancelled = true; };
    }, []);

    const sortedHolidays = useMemo(() => {
        return [...holidays].sort((a, b) => a.date.localeCompare(b.date));
    }, [holidays]);

    const handleAdd = () => {
        setFeedback(null);
        if (!newDate) {
            setFeedback({ type: 'error', message: 'Seleccione una fecha' });
            return;
        }
        if (!newName.trim()) {
            setFeedback({ type: 'error', message: 'Ingrese un nombre' });
            return;
        }
        if (holidays.some((h) => h.date === newDate)) {
            setFeedback({ type: 'error', message: 'La fecha ya existe' });
            return;
        }
        setHolidays([...holidays, { date: newDate, name: newName.trim() }]);
        setNewDate('');
        setNewName('');
    };

    const handleRemove = (date: string) => {
        setHolidays(holidays.filter((h) => h.date !== date));
    };

    const handlePreload = (source: HolidayEntry[]) => {
        const merged = [...holidays];
        for (const entry of source) {
            if (!merged.some((h) => h.date === entry.date)) {
                merged.push(entry);
            }
        }
        setHolidays(merged);
        setFeedback(null);
    };

    const handleSave = async () => {
        setSaving(true);
        setFeedback(null);
        try {
            await saveHolidays(holidays);
            setFeedback({ type: 'success', message: 'Días festivos guardados' });
        } catch (error) {
            setFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Error al guardar' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="bg-slate-50 p-5 rounded-lg border border-slate-200">
            <button
                type="button"
                onClick={() => setCollapsed(!collapsed)}
                className="flex items-center justify-between w-full text-left"
                aria-expanded={!collapsed}
            >
                <h3 className="text-lg font-semibold text-slate-700 flex items-center gap-2">
                    <Flag className="w-5 h-5" />
                    Gestión de Días Festivos
                </h3>
                <span className="bg-blue-100 text-blue-800 text-xs px-2.5 py-1 rounded-full font-semibold">
                    {holidays.length}
                </span>
            </button>

            {!collapsed && (
                <div className="space-y-4 mt-4">
                    {loading && (
                        <p className="text-sm text-slate-500">Cargando días festivos...</p>
                    )}

                    {!loading && holidays.length === 0 && (
                        <p className="text-sm text-slate-500 italic">
                            No hay días festivos configurados. Use los botones de precarga o agregue fechas manualmente.
                        </p>
                    )}

                    {holidays.length > 0 && (
                        <div className="bg-white border border-slate-300 rounded p-2 max-h-52 overflow-y-auto">
                            {sortedHolidays.map((holiday) => (
                                <div
                                    key={holiday.date}
                                    className="flex justify-between items-center text-sm py-1.5 px-2 border-b border-slate-100 last:border-b-0"
                                >
                                    <span className="text-slate-700">
                                        <Calendar className="w-3.5 h-3.5 inline mr-2 text-slate-400" />
                                        {holiday.date} - {holiday.name}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => handleRemove(holiday.date)}
                                        className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition"
                                        aria-label={`Eliminar ${holiday.name}`}
                                        title="Eliminar"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-2">
                        <div className="flex-1">
                            <label htmlFor="holiday-date" className="block text-xs font-medium text-slate-600 mb-1">Fecha</label>
                            <input
                                id="holiday-date"
                                type="date"
                                value={newDate}
                                onChange={(e) => setNewDate(e.target.value)}
                                className={inputClasses}
                            />
                        </div>
                        <div className="flex-[2]">
                            <label htmlFor="holiday-name" className="block text-xs font-medium text-slate-600 mb-1">Nombre</label>
                            <input
                                id="holiday-name"
                                type="text"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                placeholder="Ej: Año Nuevo"
                                className={inputClasses}
                            />
                        </div>
                        <div className="flex items-end">
                            <button
                                type="button"
                                onClick={handleAdd}
                                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded transition font-medium"
                            >
                                Agregar
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => handlePreload(COLOMBIAN_HOLIDAYS_2026)}
                            className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm py-2 rounded transition font-medium"
                        >
                            Precargar 2026
                        </button>
                        <button
                            type="button"
                            onClick={() => handlePreload(COLOMBIAN_HOLIDAYS_2027)}
                            className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm py-2 rounded transition font-medium"
                        >
                            Precargar 2027
                        </button>
                    </div>

                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white py-2 rounded transition font-medium"
                    >
                        {saving ? 'Guardando...' : 'Guardar Cambios'}
                    </button>

                    {feedback && (
                        <p className={`text-sm ${feedback.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                            {feedback.message}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
};

export default HolidayManager;
