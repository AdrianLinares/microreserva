import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Booking, BookingStatus } from '../types';
import { EQUIPMENT_LIST, TIME_SLOTS } from '../constants';
import * as api from '../services/api';
import { Pencil, X, Calendar as CalendarIcon, Lock, Trash2, Copy, Check, Download } from 'lucide-react';
import html2pdf from 'html2pdf.js';

interface AdminPanelProps {
    bookings: Booking[];
    refreshData: () => Promise<void>;
    onLogout: () => void;
}

const formatDate = (date: Date) => date.toISOString().split('T')[0];
const getDayLabel = (date: Date) => date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

const AdminPanel: React.FC<AdminPanelProps> = ({ bookings, refreshData, onLogout }) => {
    const [notificationEmail, setNotificationEmail] = useState('');
    const [notificationStatus, setNotificationStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
    const [emailCopied, setEmailCopied] = useState(false);
    const [blockLoading, setBlockLoading] = useState(false);
    const [editLoading, setEditLoading] = useState(false);

    // State for blocking
    const [blockReason, setBlockReason] = useState('Mantenimiento');
    const [blockType, setBlockType] = useState<'single' | 'range' | 'indefinite'>('single');
    const [blockStartDate, setBlockStartDate] = useState('');
    const [blockEndDate, setBlockEndDate] = useState('');
    const [blockEquipmentId, setBlockEquipmentId] = useState<number | 'all'>('all');

    // State for editing
    const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
    const [editForm, setEditForm] = useState({ date: '', equipmentId: 0, timeSlotId: '' });
    const [swapTargetId, setSwapTargetId] = useState('');

    // State for Calendar Preview
    const [weekOffset, setWeekOffset] = useState(0);
    const weekDays = useMemo(() => api.generateWeekDays(weekOffset), [weekOffset]);
    const calendarRef = useRef<HTMLDivElement>(null);
    const [pdfGenerating, setPdfGenerating] = useState(false);

    const pendingBookings = useMemo(() => bookings.filter(b => b.status === 'pending'), [bookings]);

    const userEmails = useMemo(() => {
        const emailSet = new Set<string>();
        bookings.forEach(b => {
            if (b.status !== 'blocked' && b.userEmail) {
                emailSet.add(b.userEmail.trim());
            }
        });
        return Array.from(emailSet).sort();
    }, [bookings]);

    const emailListForGmail = useMemo(() => userEmails.join(', '), [userEmails]);

    useEffect(() => {
        (async () => {
            try {
                const settings = await api.getAdminSettings();
                setNotificationEmail(settings.notificationEmail);
            } catch (error) {
                console.error('Error loading settings:', error);
            }
        })();
    }, []);

    const handleStatusChange = async (bookingId: string, newStatus: 'approved' | 'available' | 'blocked') => {
        try {
            if (newStatus === 'available') {
                await api.deleteBooking(bookingId);
            } else {
                await api.updateBookingStatus(bookingId, newStatus);
            }
            await refreshData();
        } catch (error) {
            alert('Error: ' + (error instanceof Error ? error.message : 'Unknown error'));
        }
    };

    const handleSendNotifications = async () => {
        if (!notificationEmail) {
            alert("Por favor ingrese un correo de remitente.");
            return;
        }

        setNotificationStatus('sending');
        try {
            // Save email for next time
            await api.saveAdminSettings({ notificationEmail });

            // Mock sending email
            console.log(`Sending notifications from ${notificationEmail} to approved/rejected users...`);
            setNotificationStatus('sent');
            setTimeout(() => setNotificationStatus('idle'), 3000);
        } catch (error) {
            alert('Error: ' + (error instanceof Error ? error.message : 'Unknown error'));
            setNotificationStatus('idle');
        }
    };

    const handleCopyEmails = async () => {
        try {
            await navigator.clipboard.writeText(emailListForGmail);
            setEmailCopied(true);
            setTimeout(() => setEmailCopied(false), 2000);
        } catch (error) {
            alert('Error al copiar: ' + (error instanceof Error ? error.message : 'Unknown error'));
        }
    };

    const handleDownloadPDF = async () => {
        if (!calendarRef.current) return;

        setPdfGenerating(true);
        try {
            const weekStart = formatDate(weekDays[0]);
            const weekEnd = formatDate(weekDays[weekDays.length - 1]);
            const fileName = `Turnos_Sala_Petrografia_${weekStart}_${weekEnd}.pdf`;

            // Construir HTML manualmente con los datos
            let tableRows = '';

            for (const day of weekDays) {
                const dayStr = formatDate(day);
                const dayLabel = getDayLabel(day);

                // Encabezado del día
                tableRows += `
                    <tr style="background-color: #e5e7eb; font-weight: bold;">
                        <td colspan="${EQUIPMENT_LIST.length + 1}" style="padding: 6px 8px; font-size: 12px; border: 1px solid #999;">
                            ${dayLabel}
                        </td>
                    </tr>
                `;

                // Filas de horarios
                for (const slot of TIME_SLOTS) {
                    const isLunchBreak = slot.id === '12:00';
                    const rowStyle = isLunchBreak ? 'border-top: 1px solid #666;' : '';

                    tableRows += `<tr style="${rowStyle}">`;

                    // Columna de horario
                    tableRows += `
                        <td style="padding: 2px 2px 2px 2px; font-size: 12px; border: 1px solid #ccc; text-align: center; background-color: #f9fafb; font-weight: 400; width: 90px;">
                            ${slot.label}
                        </td>
                    `;

                    // Columnas de equipos
                    for (const eq of EQUIPMENT_LIST) {
                        const booking = getBookingForSlot(eq.id, slot.id, dayStr);
                        const indefiniteBlock = getIndefiniteBlockForSlot(eq.id, dayStr);
                        const displayBooking = indefiniteBlock || booking;
                        const status = indefiniteBlock ? 'blocked' : (booking ? booking.status : 'available');

                        let bgColor = '#d1fae5'; // available (verde claro)
                        let content = '';

                        if (status === 'approved') {
                            bgColor = '#dbeafe'; // azul claro
                            content = `<div style="font-size: 8px; text-align: center;"><strong>${displayBooking.userName || ''}</strong><br/><span style="font-size: 7px;">${displayBooking.userGroup || ''}</span></div>`;
                        } else if (status === 'pending') {
                            bgColor = '#fef3c7'; // amarillo claro
                            content = `<div style="font-size: 8px; text-align: center;"><strong>${displayBooking.userName || ''}</strong><br/><span style="font-size: 7px;">${displayBooking.userGroup || ''}</span></div>`;
                        } else if (status === 'blocked') {
                            bgColor = '#f3f4f6'; // gris claro
                            content = `<div style="font-size: 8px; text-align: center; color: #666;">🔒 ${displayBooking.blockedReason || 'Bloqueado'}</div>`;
                        }

                        tableRows += `
                            <td style="padding: 8px 10px; font-size: 8px; border: 1px solid #ccc; background-color: ${bgColor}; min-width: 120px; max-width: 120px; overflow: hidden;">
                                ${content}
                            </td>
                        `;
                    }

                    tableRows += `</tr>`;
                }
            }

            const html = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <style>
                        * { margin: 0; padding: 0; box-sizing: border-box; }
                        body { font-family: Arial, sans-serif; padding: 10px; }
                        table { width: 100%; border-collapse: collapse; table-layout: fixed; }
                        th, td { border: 1px solid #ccc; }
                    </style>
                </head>
                <body>
                    <h1 style="text-align: center; font-size: 18px; margin-bottom: 4px; font-weight: 800;">Turnos Sala de Petrografía DGB</h1>
                    <p style="text-align: center; font-size: 12px; color: #666; font-weight: 400; margin-bottom: 8px;">
                        Semana del ${new Date(weekDays[0]).toLocaleDateString('es-ES')} al ${new Date(weekDays[weekDays.length - 1]).toLocaleDateString('es-ES')}
                    </p>
                    <table>
                        <thead>
                            <tr style="background-color: #f3f4f6;">
                                <th style="padding: 5px; font-size: 9px; border: 1px solid #999; width: 70px;">Horario</th>
                                ${EQUIPMENT_LIST.map(eq => `
                                    <th style="padding: 4px; font-size: 8.5px; border: 1px solid #999; text-align: center; min-width: 80px;">
                                        <div style="font-weight: bold; line-height: 1.2;">${eq.name}</div>
                                        <div style="font-size: 7px; color: #666; line-height: 1.2;">${eq.brand}</div>
                                    </th>
                                `).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${tableRows}
                        </tbody>
                    </table>
                </body>
                </html>
            `;

            const opt: any = {
                margin: [3, 3, 3, 3],
                filename: fileName,
                image: { type: 'jpeg' as const, quality: 0.98 },
                html2canvas: {
                    scale: 2,
                    useCORS: true,
                    letterRendering: true
                },
                jsPDF: {
                    unit: 'mm',
                    format: 'letter',
                    orientation: 'landscape'
                }
            };

            await html2pdf().set(opt).from(html).save();
        } catch (error) {
            alert('Error al generar PDF: ' + (error instanceof Error ? error.message : 'Unknown error'));
        } finally {
            setPdfGenerating(false);
        }
    };

    const handleBlockDay = async () => {
        // Validate inputs based on block type
        if (blockType === 'single' && !blockStartDate) {
            alert("Seleccione una fecha");
            return;
        }
        if (blockType === 'range' && (!blockStartDate || !blockEndDate)) {
            alert("Seleccione fecha de inicio y fin");
            return;
        }
        if (blockType === 'range' && blockStartDate > blockEndDate) {
            alert("La fecha de inicio debe ser anterior a la fecha de fin");
            return;
        }
        if (blockType === 'indefinite' && !blockStartDate) {
            alert("Seleccione una fecha de inicio");
            return;
        }

        setBlockLoading(true);
        const timestamp = Date.now();
        let blockMessage = '';

        try {
            // Helper function to get date range
            const getDateRange = (start: string, end: string): string[] => {
                const dates: string[] = [];
                const current = new Date(start);
                const finalDate = new Date(end);

                while (current <= finalDate) {
                    dates.push(current.toISOString().split('T')[0]);
                    current.setDate(current.getDate() + 1);
                }
                return dates;
            };

            // Get dates to block
            let datesToBlock: string[] = [];
            if (blockType === 'single') {
                datesToBlock = [blockStartDate];
                blockMessage = `Se bloqueó el ${new Date(blockStartDate).toLocaleDateString('es-ES')}`;
            } else if (blockType === 'range') {
                datesToBlock = getDateRange(blockStartDate, blockEndDate);
                blockMessage = `Se bloqueó desde ${new Date(blockStartDate).toLocaleDateString('es-ES')} hasta ${new Date(blockEndDate).toLocaleDateString('es-ES')}`;
            } else if (blockType === 'indefinite') {
                // For indefinite blocks, create a single "master" block with indefinite flag
                const id = `indefinite-${blockStartDate}-${blockEquipmentId}-${timestamp}`;
                try {
                    await api.addBooking({
                        id,
                        date: blockStartDate,
                        equipmentId: blockEquipmentId === 'all' ? 0 : blockEquipmentId as number,
                        timeSlotId: 'all',
                        status: 'blocked',
                        blockedReason: blockReason,
                        blockType: 'indefinite',
                        blockStartDate: blockStartDate,
                        timestamp
                    });
                } catch (e) {
                    await api.updateBookingStatus(id, 'blocked', {
                        blockedReason: blockReason,
                        blockType: 'indefinite',
                        blockStartDate: blockStartDate
                    });
                }
                blockMessage = `Se bloqueó indefinidamente a partir del ${new Date(blockStartDate).toLocaleDateString('es-ES')} (${blockEquipmentId === 'all' ? 'Todos los equipos' : 'Equipo seleccionado'})`;
            }

            // Apply blocking for single and range blocks
            if (blockType === 'single' || blockType === 'range') {
                for (const dateStr of datesToBlock) {
                    for (const slot of TIME_SLOTS) {
                        for (const eq of EQUIPMENT_LIST) {
                            if (blockEquipmentId === 'all' || blockEquipmentId === eq.id) {
                                const id = `${dateStr}-${eq.id}-${slot.id}`;
                                try {
                                    await api.addBooking({
                                        id,
                                        date: dateStr,
                                        equipmentId: eq.id,
                                        timeSlotId: slot.id,
                                        status: 'blocked',
                                        blockedReason: blockReason,
                                        blockType: blockType === 'single' ? 'single' : 'range',
                                        blockStartDate,
                                        blockEndDate: blockType === 'range' ? blockEndDate : undefined,
                                        timestamp
                                    });
                                } catch (e) {
                                    await api.updateBookingStatus(id, 'blocked', {
                                        blockedReason: blockReason,
                                        blockType: blockType === 'single' ? 'single' : 'range',
                                        blockStartDate,
                                        blockEndDate: blockType === 'range' ? blockEndDate : undefined
                                    });
                                }
                            }
                        }
                    }
                }
            }

            alert(`${blockMessage}. Razón: ${blockReason}`);
            // Reset form
            setBlockStartDate('');
            setBlockEndDate('');
            setBlockType('single');
            setBlockReason('Mantenimiento');
            await refreshData();
        } catch (error) {
            alert('Error al bloquear: ' + (error instanceof Error ? error.message : 'Unknown error'));
        } finally {
            setBlockLoading(false);
        }
    };

    // Edit Handlers
    const handleEditClick = (booking: Booking) => {
        setEditingBooking(booking);
        setEditForm({
            date: booking.date,
            equipmentId: booking.equipmentId,
            timeSlotId: booking.timeSlotId
        });
        setSwapTargetId('');
    };

    const handleDeleteBooking = async (e?: React.MouseEvent) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }

        if (!editingBooking) return;

        const confirmMessage = editingBooking.status === 'blocked'
            ? "¿Desea desbloquear este horario y eliminar la restricción?"
            : `¿Está seguro de eliminar la reserva de ${editingBooking.userName}? Esta acción no se puede deshacer.`;

        if (window.confirm(confirmMessage)) {
            setEditLoading(true);
            try {
                await api.deleteBooking(editingBooking.id);
                setEditingBooking(null);
                await refreshData();
            } catch (error) {
                console.error("Error deleting booking:", error);
                alert("Ocurrió un error al intentar eliminar la reserva.");
            } finally {
                setEditLoading(false);
            }
        }
    };

    const handleSaveEdit = async () => {
        if (!editingBooking) return;
        setEditLoading(true);
        try {
            const result = await api.updateBookingDetails(editingBooking.id, {
                date: editForm.date,
                equipmentId: editForm.equipmentId,
                timeSlotId: editForm.timeSlotId
            });
            setEditingBooking(null);
            setSwapTargetId('');
            await refreshData();
            alert("Solicitud modificada con éxito.");
        } catch (e: any) {
            alert("Error al modificar: " + e.message);
        } finally {
            setEditLoading(false);
        }
    };

    const handleSwapBookings = async () => {
        if (!editingBooking) return;
        if (!swapTargetId) {
            alert("Seleccione la segunda reserva para intercambiar.");
            return;
        }

        const target = bookings.find(b => b.id === swapTargetId);
        if (!target) {
            alert("Reserva objetivo no encontrada.");
            return;
        }

        const confirmMessage = `¿Desea intercambiar los turnos de ${editingBooking.userName} con ${target.userName}?`;
        if (!window.confirm(confirmMessage)) return;

        setEditLoading(true);
        try {
            await api.swapBookingSlots(editingBooking.id, swapTargetId);
            setEditingBooking(null);
            setSwapTargetId('');
            await refreshData();
            alert("Intercambio realizado con éxito.");
        } catch (e: any) {
            alert("Error al intercambiar: " + e.message);
        } finally {
            setEditLoading(false);
        }
    };

    // Grid Helpers
    const bookingMap = useMemo(() => {
        const map = new Map<string, Booking>();
        bookings.forEach(b => {
            map.set(`${b.date}-${b.equipmentId}-${b.timeSlotId}`, b);
        });
        return map;
    }, [bookings]);

    const getBookingForSlot = (eqId: number, timeId: string, date: string) => {
        return bookingMap.get(`${date}-${eqId}-${timeId}`);
    };

    // Check if equipment is blocked indefinitely for a given date
    const getIndefiniteBlockForSlot = (eqId: number, date: string) => {
        return bookings.find(b =>
            b.blockType === 'indefinite' &&
            b.status === 'blocked' &&
            (b.equipmentId === 0 || b.equipmentId === eqId) &&
            date >= (b.blockStartDate || '')
        );
    };

    const getCellColor = (status: BookingStatus | undefined) => {
        switch (status) {
            case 'approved': return 'bg-status-approved text-blue-900 border-blue-200 hover:bg-blue-300';
            case 'pending': return 'bg-status-pending text-amber-900 border-amber-200 hover:bg-amber-300';
            case 'blocked': return 'bg-status-blocked text-gray-500 border-gray-300 hover:bg-gray-300';
            case 'available':
            default: return 'bg-status-available text-green-900 border-green-200 opacity-60'; // Slightly clearer for admin that it is empty
        }
    };

    const getEquipmentName = (id: number) => EQUIPMENT_LIST.find(e => e.id === id)?.name || 'Unknown';
    const getTimeLabel = (id: string) => TIME_SLOTS.find(t => t.id === id)?.label || id;

    const inputClasses = "w-full px-3 py-2 bg-white border border-slate-300 rounded text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-slate-400";
    const swapCandidates = useMemo(() => {
        if (!editingBooking) return [] as Booking[];
        return bookings.filter(b => b.id !== editingBooking.id && b.status !== 'blocked');
    }, [bookings, editingBooking]);

    return (
        <div className="bg-white rounded shadow p-6 relative">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
                <h2 className="text-2xl font-bold text-slate-800">Panel de Administrador</h2>
                <button onClick={onLogout} className="text-red-600 hover:text-red-800 font-medium">
                    Cerrar Sesión
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
                {/* Pending Requests */}
                <div>
                    <h3 className="text-lg font-semibold mb-4 text-amber-600">Solicitudes Pendientes ({pendingBookings.length})</h3>
                    <div className="space-y-3 max-h-[500px] overflow-y-auto">
                        {pendingBookings.length === 0 ? (
                            <p className="text-slate-400 italic">No hay solicitudes pendientes.</p>
                        ) : (
                            pendingBookings.map(booking => (
                                <div key={booking.id} className="border border-amber-200 bg-amber-50 p-4 rounded-lg shadow-sm relative">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <p className="font-bold text-slate-800">{booking.userName}</p>
                                            <p className="text-xs text-slate-500">{booking.userGroup}</p>
                                        </div>
                                        <span className="text-xs bg-amber-200 text-amber-800 px-2 py-1 rounded">En espera</span>
                                    </div>
                                    <div className="text-sm text-slate-700 space-y-1 mb-3">
                                        <p><span className="font-semibold">Equipo:</span> {getEquipmentName(booking.equipmentId)}</p>
                                        <p><span className="font-semibold">Fecha:</span> {booking.date}</p>
                                        <p><span className="font-semibold">Hora:</span> {getTimeLabel(booking.timeSlotId)}</p>
                                        <p><span className="font-semibold">Email:</span> {booking.userEmail}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleStatusChange(booking.id, 'approved')}
                                            className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs py-2 rounded transition font-medium"
                                        >
                                            Aprobar
                                        </button>
                                        <button
                                            onClick={() => handleEditClick(booking)}
                                            className="flex-1 bg-blue-500 hover:bg-blue-600 text-white text-xs py-2 rounded transition font-medium flex items-center justify-center gap-1"
                                        >
                                            <Pencil className="w-3 h-3" /> Modificar
                                        </button>
                                        <button
                                            onClick={() => handleStatusChange(booking.id, 'available')}
                                            className="flex-1 bg-red-500 hover:bg-red-600 text-white text-xs py-2 rounded transition font-medium"
                                        >
                                            Rechazar
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Controls */}
                <div className="space-y-8">

                    {/* Notifications */}
                    {/* <div className="bg-slate-50 p-5 rounded-lg border border-slate-200">
                        <h3 className="text-lg font-semibold mb-3 text-slate-700">Sistema de Notificaciones</h3>
                        <div className="flex flex-col gap-3">
                            <label className="text-sm text-slate-600">Correo remitente:</label>
                            <input
                                type="email"
                                value={notificationEmail}
                                onChange={e => setNotificationEmail(e.target.value)}
                                className={inputClasses}
                                placeholder="admin@laboratorio.com"
                            />
                            <button
                                onClick={handleSendNotifications}
                                disabled={notificationStatus !== 'idle'}
                                className={`w-full py-2 rounded text-white transition ${notificationStatus === 'sent' ? 'bg-green-500' : 'bg-blue-600 hover:bg-blue-700'
                                    }`}
                            >
                                {notificationStatus === 'idle' && 'Enviar Notificaciones de Cambios'}
                                {notificationStatus === 'sending' && 'Enviando...'}
                                {notificationStatus === 'sent' && '¡Enviado!'}
                            </button>
                        </div>
                    </div> */}

                    {/* Email List */}
                    <div className="bg-slate-50 p-5 rounded-lg border border-slate-200">
                        <h3 className="text-lg font-semibold mb-3 text-slate-700">Lista de Correos</h3>
                        <div className="space-y-3">
                            <p className="text-sm text-slate-600">
                                Correos de solicitantes registrados ({userEmails.length}):
                            </p>
                            <div className="bg-white border border-slate-300 rounded p-3 max-h-32 overflow-y-auto">
                                {userEmails.length > 0 ? (
                                    <p className="text-xs text-slate-700 font-mono break-all leading-relaxed">
                                        {emailListForGmail}
                                    </p>
                                ) : (
                                    <p className="text-sm text-slate-400 italic">No hay correos registrados</p>
                                )}
                            </div>
                            <button
                                onClick={handleCopyEmails}
                                disabled={userEmails.length === 0}
                                className={'w-full py-2 rounded text-white transition flex items-center justify-center gap-2 ' + (emailCopied ? 'bg-green-500' : userEmails.length > 0 ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-300 cursor-not-allowed')}
                            >
                                {emailCopied ? (
                                    <>
                                        <Check className="w-4 h-4" />
                                        Copiado!
                                    </>
                                ) : (
                                    <>
                                        <Copy className="w-4 h-4" />
                                        Copiar para Gmail
                                    </>
                                )}
                            </button>
                            <p className="text-xs text-slate-500 italic">
                                Lista optimizada para pegar directamente en el campo Para de Gmail
                            </p>
                        </div>
                    </div>

                    {/* Blocking */}
                    <div className="bg-slate-50 p-5 rounded-lg border border-slate-200">
                        <h3 className="text-lg font-semibold mb-3 text-slate-700">Bloqueo de Equipos</h3>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-sm mb-1 text-slate-600">Motivo</label>
                                <input
                                    type="text"
                                    value={blockReason}
                                    onChange={e => setBlockReason(e.target.value)}
                                    className={inputClasses}
                                    placeholder="Ej: Mantenimiento, Calibración, Reparación"
                                />
                            </div>

                            <div>
                                <label className="block text-sm mb-1 text-slate-600">Tipo de Bloqueo</label>
                                <select
                                    value={blockType}
                                    onChange={e => {
                                        setBlockType(e.target.value as 'single' | 'range' | 'indefinite');
                                        setBlockStartDate('');
                                        setBlockEndDate('');
                                    }}
                                    className={inputClasses}
                                >
                                    <option value="single">Un solo día</option>
                                    <option value="range">Rango de fechas</option>
                                    <option value="indefinite">Indefinido (hasta desbloquear manualmente)</option>
                                </select>
                            </div>

                            {(blockType === 'single' || blockType === 'range' || blockType === 'indefinite') && (
                                <div>
                                    <label className="block text-sm mb-1 text-slate-600">
                                        {blockType === 'indefinite' ? 'Fecha de Inicio' : 'Fecha'}
                                    </label>
                                    <input
                                        type="date"
                                        value={blockStartDate}
                                        onChange={e => setBlockStartDate(e.target.value)}
                                        className={inputClasses}
                                    />
                                </div>
                            )}

                            {blockType === 'range' && (
                                <div>
                                    <label className="block text-sm mb-1 text-slate-600">Fecha de Fin</label>
                                    <input
                                        type="date"
                                        value={blockEndDate}
                                        onChange={e => setBlockEndDate(e.target.value)}
                                        className={inputClasses}
                                        min={blockStartDate}
                                    />
                                </div>
                            )}

                            {blockType === 'indefinite' && (
                                <div className="bg-amber-50 border border-amber-200 rounded p-3">
                                    <p className="text-sm text-amber-700">
                                        <strong>⚠️ Bloqueo Indefinido:</strong> El equipo será bloqueado a partir de la fecha de inicio hasta que se desbloquee manualmente desde el panel de administración.
                                    </p>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm mb-1 text-slate-600">Equipo(s)</label>
                                <select
                                    value={blockEquipmentId}
                                    onChange={e => setBlockEquipmentId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                                    className={inputClasses}
                                >
                                    <option value="all">Todas las Mesas</option>
                                    {EQUIPMENT_LIST.map(eq => (
                                        <option key={eq.id} value={eq.id}>{eq.name}</option>
                                    ))}
                                </select>
                            </div>
                            <button
                                onClick={handleBlockDay}
                                disabled={blockLoading}
                                className="w-full bg-slate-600 hover:bg-slate-700 text-white py-2 rounded transition text-sm shadow-sm disabled:opacity-50"
                            >
                                {blockLoading ? 'Bloqueando...' : `Bloquear ${blockType === 'indefinite' ? 'Indefinidamente' : 'Horarios'}`}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Calendar Preview Section */}
            <div className="border-t border-slate-200 pt-8">
                <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                    <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <CalendarIcon className="w-5 h-5" /> Vista Previa del Calendario
                    </h3>
                    <p className="text-sm text-slate-500">
                        Haz clic en una reserva del calendario para editarla o eliminarla.
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleDownloadPDF}
                            disabled={pdfGenerating}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition text-sm font-medium disabled:opacity-50"
                        >
                            <Download className="w-4 h-4" />
                            {pdfGenerating ? 'Generando...' : 'Descargar PDF'}
                        </button>
                        <div className="flex items-center bg-slate-100 rounded-lg p-1">
                            <button
                                onClick={() => setWeekOffset(0)}
                                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${weekOffset === 0 ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                Esta Semana
                            </button>
                            <button
                                onClick={() => setWeekOffset(1)}
                                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${weekOffset === 1 ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                Próxima Semana
                            </button>
                        </div>
                    </div>
                </div>

                <div className="space-y-6" ref={calendarRef}>
                    {weekDays.map((day, dayIndex) => {
                        const dayStr = formatDate(day);
                        const isToday = formatDate(day) === formatDate(new Date());

                        return (
                            <div key={dayIndex} className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                                <div className={`p-3 border-b border-slate-100 flex items-center gap-2 ${isToday ? 'bg-blue-50' : 'bg-slate-50'}`}>
                                    <h4 className={`font-bold text-sm capitalize ${isToday ? 'text-blue-700' : 'text-slate-700'}`}>
                                        {getDayLabel(day)}
                                    </h4>
                                    {isToday && (
                                        <span className="bg-blue-600 text-white text-[10px] uppercase font-bold px-2 py-0.5 rounded-full">Hoy</span>
                                    )}
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="min-w-max w-full border-collapse">
                                        <thead>
                                            <tr>
                                                <th className="bg-white border-b border-r p-2 text-left w-20 text-slate-500 font-semibold text-[10px] uppercase tracking-wider">
                                                    Horario
                                                </th>
                                                {EQUIPMENT_LIST.map(eq => (
                                                    <th key={eq.id} className="min-w-[140px] border-b border-r p-2 text-left bg-slate-50/50">
                                                        <div className="font-bold text-slate-800 text-[11px]">{eq.name}</div>
                                                        <div className="text-[9px] text-slate-500 leading-tight">{eq.brand}</div>
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {TIME_SLOTS.map((slot) => {
                                                let rowClasses = "border-b border-r p-1 h-12 relative transition-all ";
                                                if (slot.id === '12:00') rowClasses += "border-t-[2px] border-t-slate-300 ";

                                                return (
                                                    <tr key={slot.id}>
                                                        <td className={`bg-white border-b border-r p-2 text-[10px] font-mono text-slate-600 ${slot.id === '12:00' ? 'border-t-[2px] border-t-slate-300' : ''}`}>
                                                            {slot.label}
                                                        </td>
                                                        {EQUIPMENT_LIST.map(eq => {
                                                            const booking = getBookingForSlot(eq.id, slot.id, dayStr);
                                                            const indefiniteBlock = getIndefiniteBlockForSlot(eq.id, dayStr);
                                                            const displayBooking = indefiniteBlock || booking;
                                                            const status = indefiniteBlock ? 'blocked' : (booking ? booking.status : 'available');

                                                            return (
                                                                <td
                                                                    key={eq.id}
                                                                    className={`${rowClasses} ${getCellColor(status)} ${displayBooking ? 'cursor-pointer' : ''}`}
                                                                    onClick={() => displayBooking && handleEditClick(displayBooking)}
                                                                    title={displayBooking ? 'Haz clic para gestionar' : 'Disponible'}
                                                                >
                                                                    <div className="h-full flex flex-col justify-center text-[10px]">
                                                                        {displayBooking ? (
                                                                            status === 'blocked' ? (
                                                                                <div className="flex flex-col items-center opacity-60">
                                                                                    <Lock className="w-3 h-3 mb-0.5" />
                                                                                    <span className="text-center leading-tight text-[9px]">{displayBooking.blockedReason || 'Bloqueado'}</span>
                                                                                    {indefiniteBlock && <span className="text-center leading-tight text-[8px] mt-0.5">Indefinido</span>}
                                                                                </div>
                                                                            ) : (
                                                                                <div className="px-1">
                                                                                    <span className="font-bold block truncate">{displayBooking.userName || 'Usuario'}</span>
                                                                                    <span className="block truncate opacity-80 text-[9px]">{displayBooking.userGroup}</span>
                                                                                </div>
                                                                            )
                                                                        ) : (
                                                                            <div className="text-center text-slate-400 opacity-0 hover:opacity-100">
                                                                                -
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Edit Modal Overlay */}
            {editingBooking && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black bg-opacity-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md animate-fade-in p-6">
                        <div className="flex justify-between items-center mb-4 border-b pb-2">
                            <h3 className="text-lg font-bold text-slate-800">
                                {editingBooking.status === 'blocked' ? 'Gestionar Bloqueo' : 'Modificar Reserva'}
                            </h3>
                            <button type="button" onClick={() => setEditingBooking(null)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            {editingBooking.status !== 'blocked' ? (
                                <div className="bg-blue-50 p-3 rounded text-sm text-blue-800 mb-2">
                                    Solicitante: <strong>{editingBooking.userName}</strong>
                                    <div className="text-xs mt-1 text-blue-600">Grupo: {editingBooking.userGroup}</div>
                                </div>
                            ) : (
                                <div className="bg-slate-100 p-3 rounded text-sm text-slate-700 mb-2 flex items-center gap-2">
                                    <Lock className="w-4 h-4" />
                                    Bloqueo Administrativo: <strong>{editingBooking.blockedReason}</strong>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Nueva Fecha</label>
                                <input
                                    type="date"
                                    className={inputClasses}
                                    value={editForm.date}
                                    onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Nuevo Equipo</label>
                                <select
                                    className={inputClasses}
                                    value={editForm.equipmentId}
                                    onChange={(e) => setEditForm({ ...editForm, equipmentId: Number(e.target.value) })}
                                >
                                    {EQUIPMENT_LIST.map(eq => (
                                        <option key={eq.id} value={eq.id}>{eq.name} - {eq.brand}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Nuevo Horario</label>
                                <select
                                    className={inputClasses}
                                    value={editForm.timeSlotId}
                                    onChange={(e) => setEditForm({ ...editForm, timeSlotId: e.target.value })}
                                >
                                    {TIME_SLOTS.map(slot => (
                                        <option key={slot.id} value={slot.id}>{slot.label}</option>
                                    ))}
                                </select>
                            </div>

                            {editingBooking.status !== 'blocked' && (
                                <div className="border-t border-slate-100 pt-4">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Intercambiar con</label>
                                    <select
                                        className={inputClasses}
                                        value={swapTargetId}
                                        onChange={(e) => setSwapTargetId(e.target.value)}
                                    >
                                        <option value="">Seleccione una reserva</option>
                                        {swapCandidates.map(candidate => (
                                            <option key={candidate.id} value={candidate.id}>
                                                {candidate.userName || 'Usuario'} - {candidate.date} - {getEquipmentName(candidate.equipmentId)} - {getTimeLabel(candidate.timeSlotId)}
                                            </option>
                                        ))}
                                    </select>
                                    <button
                                        type="button"
                                        onClick={handleSwapBookings}
                                        disabled={!swapTargetId}
                                        className={`mt-3 w-full py-2 rounded text-sm font-medium transition-colors ${swapTargetId
                                            ? 'bg-amber-500 text-white hover:bg-amber-600'
                                            : 'bg-amber-200 text-white cursor-not-allowed'
                                            }`}
                                    >
                                        Intercambiar Turnos
                                    </button>
                                </div>
                            )}

                            <div className="flex justify-between items-center mt-8 pt-4 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={handleDeleteBooking}
                                    disabled={editLoading}
                                    className="text-red-600 hover:text-red-800 hover:bg-red-50 px-3 py-2 rounded transition-colors text-sm font-medium flex items-center gap-1 disabled:opacity-50"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    {editLoading ? 'Procesando...' : (editingBooking.status === 'blocked' ? 'Desbloquear' : 'Eliminar Reserva')}
                                </button>

                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setEditingBooking(null)}
                                        disabled={editLoading}
                                        className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded transition-colors text-sm font-medium disabled:opacity-50"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleSaveEdit}
                                        disabled={editLoading}
                                        className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors shadow-sm text-sm font-medium disabled:opacity-50"
                                    >
                                        {editLoading ? 'Guardando...' : 'Guardar Cambios'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminPanel;