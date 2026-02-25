import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { EQUIPMENT_LIST, TIME_SLOTS, MAX_SLOTS_PER_PERSON } from './constants';
import { generateWeekDays, getBookings, addBooking, saveAdminCredentials, clearAdminCredentials, getAdminSettings } from './services/api';
import { Booking, BookingStatus } from './types';
import BookingModal from './components/BookingModal';
import AdminPanel from './components/AdminPanel';
import { User, Lock, Calendar, Clock, Filter, AlertCircle, Info, ChevronLeft, ChevronRight } from 'lucide-react';

// Helpers
const isBookingWindowOpen = () => {
    const now = new Date();
    const day = now.getDay(); // 0 Sun, 1 Mon, ... 6 Sat
    const hour = now.getHours();

    // Mon 7AM to Fri 12PM
    // Sunday (0) or Saturday (6) -> Closed
    if (day === 0 || day === 6) return false;

    // Friday (5) after 12:00 -> Closed
    if (day === 5 && hour >= 12) return false;

    // Monday (1) before 7:00 -> Closed
    if (day === 1 && hour < 7) return false;

    return true;
};

const formatDate = (date: Date) => date.toISOString().split('T')[0];
const getDayLabel = (date: Date) => date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

const App: React.FC = () => {
    // Global State
    const [isAdmin, setIsAdmin] = useState(false);
    const [showAdminLogin, setShowAdminLogin] = useState(false);
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [apiError, setApiError] = useState<string | null>(null);

    // Week Navigation State
    const [weekOffset, setWeekOffset] = useState(0);
    const weekDays = useMemo(() => generateWeekDays(weekOffset), [weekOffset]);
    // Removed activeDayIndex state as we show all days now

    // Filter State
    const [filterType, setFilterType] = useState<'all' | 'Microscopio' | 'Estereomicroscopio'>('all');
    const [filterBrand, setFilterBrand] = useState<'all' | 'ZEISS' | 'OLYMPUS'>('all');

    // Booking Flow State
    const [selectedSlots, setSelectedSlots] = useState<Array<{ date: string, equipmentId: number, timeSlotId: string }>>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [loginUsername, setLoginUsername] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [loginError, setLoginError] = useState<string | null>(null);
    const [isVerifyingLogin, setIsVerifyingLogin] = useState(false);

    // Async refresh data helper
    const refreshData = useCallback(async () => {
        try {
            setApiError(null);
            const data = await getBookings();
            setBookings(data);
        } catch (error) {
            setApiError(error instanceof Error ? error.message : 'Error al cargar datos');
        }
    }, []);

    // Initial Load
    useEffect(() => {
        (async () => {
            try {
                await refreshData();
            } finally {
                setIsLoading(false);
            }
        })();
    }, [refreshData]);

    // Filtering Equipment
    const visibleEquipment = useMemo(() => {
        return EQUIPMENT_LIST.filter(eq => {
            if (filterType !== 'all' && eq.type !== filterType) return false;
            if (filterBrand !== 'all' && eq.brand !== filterBrand) return false;
            return true;
        });
    }, [filterType, filterBrand]);

    // Derived Bookings for efficient lookup
    const getBookingForSlot = (eqId: number, timeId: string, date: string) => {
        return bookings.find(b => b.equipmentId === eqId && b.timeSlotId === timeId && b.date === date);
    };

    const isSlotSelected = (eqId: number, timeId: string, date: string) => {
        return selectedSlots.some(s => s.equipmentId === eqId && s.timeSlotId === timeId && s.date === date);
    };

    // Check if a slot is blocked indefinitely
    const isSlotBlockedIndefinitely = (eqId: number, date: string) => {
        return bookings.some(b =>
            b.blockType === 'indefinite' &&
            b.status === 'blocked' &&
            (b.equipmentId === 0 || b.equipmentId === eqId) &&
            date >= (b.blockStartDate || '')
        );
    };

    // Interactions
    const handleSlotClick = (eqId: number, timeId: string, date: string) => {
        if (isAdmin) return; // Admin views status but edits via panel

        const existingBooking = getBookingForSlot(eqId, timeId, date);

        // 1. Check for indefinite blocks
        if (isSlotBlockedIndefinitely(eqId, date)) {
            alert("Este equipo está bloqueado indefinidamente. Por favor contacte al administrador.");
            return;
        }

        // 2. If it's blocked, unavailable, pending, or approved -> Can't touch
        if (existingBooking) {
            // Optional: Show details if user wants to see who booked it (per requirements)
            if (existingBooking.status !== 'available') return;
        }

        // 3. Check Booking Window
        if (!isBookingWindowOpen()) {
            alert("Las solicitudes de turnos solo están disponibles desde el lunes 7:00 AM hasta el viernes 12:00 PM.");
            return;
        }

        // 4. Toggle Selection
        const isSelected = isSlotSelected(eqId, timeId, date);
        if (isSelected) {
            setSelectedSlots(prev => prev.filter(s => !(s.equipmentId === eqId && s.timeSlotId === timeId && s.date === date)));
        } else {
            // Check Limit for UI selection
            if (selectedSlots.length >= MAX_SLOTS_PER_PERSON) {
                alert(`Solo puedes seleccionar un máximo de ${MAX_SLOTS_PER_PERSON} turnos por solicitud.`);
                return;
            }
            setSelectedSlots(prev => [...prev, { date, equipmentId: eqId, timeSlotId: timeId }]);
        }
    };

    const handleBookingSubmit = async (userData: { name: string; email: string; group: string }) => {

        // Check global limit (History + New Selection)
        // Only count actual user bookings, not blocked slots or system blocks
        const activeBookingsCount = bookings.filter(b =>
            b.userEmail === userData.email &&
            b.userName &&  // Ensure it's an actual user booking
            (b.status === 'pending' || b.status === 'approved')
        ).length;

        // Debug: Log bookings for this user
        console.log('Active bookings count:', activeBookingsCount);

        if (activeBookingsCount + selectedSlots.length > MAX_SLOTS_PER_PERSON) {
            alert(`Límite excedido. \n\nYa tienes ${activeBookingsCount} turnos activos (pendientes o aprobados) y estás intentando solicitar ${selectedSlots.length} más. \n\nEl límite total por persona es de ${MAX_SLOTS_PER_PERSON} turnos.`);
            return;
        }

        const newBookings: Booking[] = [];
        const timestamp = Date.now();

        // We assume validation happened in modal
        selectedSlots.forEach(slot => {
            const id = `${slot.date}-${slot.equipmentId}-${slot.timeSlotId}`;
            newBookings.push({
                id,
                date: slot.date,
                equipmentId: slot.equipmentId,
                timeSlotId: slot.timeSlotId,
                status: 'pending',
                userName: userData.name,
                userEmail: userData.email,
                userGroup: userData.group,
                timestamp
            });
        });

        try {
            await Promise.all(newBookings.map(b => addBooking(b)));
            await refreshData();
            setSelectedSlots([]);
            setIsModalOpen(false);
            alert("Solicitud enviada con éxito. Esperando aprobación del administrador.");
        } catch (e: any) {
            alert("Error al reservar: " + e.message);
        }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!loginUsername || !loginPassword) {
            setLoginError("Por favor complete todos los campos");
            return;
        }

        setIsVerifyingLogin(true);
        setLoginError(null);

        try {
            saveAdminCredentials(loginUsername, loginPassword);
            // Verify credentials by calling getAdminSettings
            await getAdminSettings();
            setIsAdmin(true);
            setShowAdminLogin(false);
            setSelectedSlots([]);
            setLoginUsername('');
            setLoginPassword('');
        } catch (error) {
            clearAdminCredentials();
            setLoginError("Credenciales incorrectas");
        } finally {
            setIsVerifyingLogin(false);
        }
    };

    // Render Helpers
    const getCellColor = (status: BookingStatus | undefined, isSelected: boolean) => {
        if (isSelected) return 'bg-blue-600 text-white ring-2 ring-blue-400';
        switch (status) {
            case 'approved': return 'bg-status-approved text-blue-900 border-blue-200';
            case 'pending': return 'bg-status-pending text-amber-900 border-amber-200';
            case 'blocked': return 'bg-status-blocked text-gray-500 border-gray-300 cursor-not-allowed';
            case 'available':
            default: return 'bg-status-available hover:bg-green-400 cursor-pointer text-green-900 border-green-200 transition-colors';
        }
    };

    // Common classes for inputs
    const selectClasses = "bg-white border border-slate-300 text-slate-700 text-sm rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";
    const loginInputClasses = "w-full px-3 py-2 bg-white border border-slate-300 rounded mb-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-slate-400";

    return (
        <div className="min-h-screen flex flex-col font-sans bg-slate-50">
            {/* Header */}
            <header className="bg-slate-900 text-white p-4 shadow-md sticky top-0 z-40">
                <div className="container mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
                    <div>
                        <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
                            <Calendar className="w-6 h-6" />
                            Sala de Petrografía
                        </h1>
                        <p className="text-slate-400 text-sm">Sistema de Reserva de Microscopios</p>
                    </div>

                    <div className="flex items-center gap-4">
                        {!isAdmin ? (
                            <button
                                onClick={() => setShowAdminLogin(!showAdminLogin)}
                                className="text-sm bg-slate-800 hover:bg-slate-700 px-3 py-1 rounded border border-slate-700 flex items-center gap-2"
                            >
                                <Lock className="w-3 h-3" /> Admin Login
                            </button>
                        ) : (
                            <div className="bg-blue-900 px-3 py-1 rounded text-xs uppercase tracking-wider font-semibold">
                                Modo Administrador
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* Admin Login Modal (Simple overlay) */}
            {showAdminLogin && !isAdmin && (
                <div className="fixed inset-0 z-50 bg-black bg-opacity-60 flex items-center justify-center p-4">
                    <form onSubmit={handleLogin} className="bg-white p-6 rounded shadow-xl w-full max-w-sm animate-fade-in">
                        <h3 className="text-lg font-bold mb-4 text-slate-800">Acceso Administrativo</h3>
                        {loginError && (
                            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded">
                                {loginError}
                            </div>
                        )}
                        <input
                            className={loginInputClasses}
                            placeholder="Usuario"
                            value={loginUsername}
                            onChange={e => setLoginUsername(e.target.value)}
                            disabled={isVerifyingLogin}
                        />
                        <input
                            className={loginInputClasses.replace('mb-3', 'mb-4')}
                            placeholder="Contraseña"
                            type="password"
                            value={loginPassword}
                            onChange={e => setLoginPassword(e.target.value)}
                            disabled={isVerifyingLogin}
                        />
                        <div className="flex justify-between">
                            <button type="button" onClick={() => { setShowAdminLogin(false); setLoginError(null); }} className="text-slate-500 hover:text-slate-700" disabled={isVerifyingLogin}>Cancelar</button>
                            <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition disabled:opacity-50" disabled={isVerifyingLogin}>{isVerifyingLogin ? 'Verificando...' : 'Ingresar'}</button>
                        </div>
                    </form>
                </div>
            )}

            {/* Main Content */}
            <main className="flex-grow container mx-auto p-4 md:p-6">

                {isLoading ? (
                    // Loading skeleton
                    <div className="space-y-4">
                        <div className="h-20 bg-slate-200 rounded animate-pulse"></div>
                        <div className="h-96 bg-slate-200 rounded animate-pulse"></div>
                        <div className="h-96 bg-slate-200 rounded animate-pulse"></div>
                    </div>
                ) : apiError ? (
                    // Error banner
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded shadow-sm flex items-start justify-between">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="font-semibold text-red-800">Error al cargar datos</p>
                                <p className="text-red-700 text-sm">{apiError}</p>
                            </div>
                        </div>
                        <button
                            onClick={() => refreshData()}
                            className="text-red-600 hover:text-red-800 font-semibold text-sm whitespace-nowrap ml-4"
                        >
                            Reintentar
                        </button>
                    </div>
                ) : null}

                {isAdmin ? (
                    <AdminPanel
                        bookings={bookings}
                        refreshData={refreshData}
                        onLogout={() => { clearAdminCredentials(); setIsAdmin(false); setSelectedSlots([]); }}
                    />
                ) : !isLoading && !apiError ? (
                    <div className="space-y-6">

                        {/* Info Bar */}
                        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded shadow-sm text-sm text-blue-800 flex items-start gap-3">
                            <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="font-semibold">Horario de Solicitudes:</p>
                                <p>Lunes 7:00 AM - Viernes 12:00 PM.</p>
                                <p className="mt-1 font-semibold text-blue-900">Límite por persona: {MAX_SLOTS_PER_PERSON} turnos.</p>
                                {!isBookingWindowOpen() && (
                                    <p className="text-red-600 font-bold mt-1 uppercase">
                                        Actualmente fuera de horario para nuevas solicitudes.
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Filters and Week Navigation */}
                        <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded shadow-sm border border-slate-100">

                            {/* Week Navigation */}
                            <div className="flex items-center bg-slate-100 rounded-lg p-1">
                                <button
                                    onClick={() => { setWeekOffset(0); }}
                                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${weekOffset === 0 ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                >
                                    Esta Semana
                                </button>
                                <button
                                    onClick={() => { setWeekOffset(1); }}
                                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${weekOffset === 1 ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                >
                                    Próxima Semana
                                </button>
                            </div>

                            <div className="flex flex-wrap gap-2 items-center">
                                <div className="flex items-center gap-2 text-slate-500 mr-2">
                                    <Filter className="w-4 h-4" />
                                    <span className="text-sm font-semibold uppercase hidden sm:inline">Filtros:</span>
                                </div>
                                <select
                                    className={selectClasses}
                                    value={filterType}
                                    onChange={(e) => setFilterType(e.target.value as any)}
                                >
                                    <option value="all">Todos los Equipos</option>
                                    <option value="Microscopio">Microscopios</option>
                                    <option value="Estereomicroscopio">Estereomicroscopios</option>
                                </select>
                                <select
                                    className={selectClasses}
                                    value={filterBrand}
                                    onChange={(e) => setFilterBrand(e.target.value as any)}
                                >
                                    <option value="all">Todas las Marcas</option>
                                    <option value="ZEISS">ZEISS</option>
                                    <option value="OLYMPUS">OLYMPUS</option>
                                </select>
                            </div>
                        </div>

                        {/* Calendar Grids - All Days */}
                        <div className="space-y-8">
                            {weekDays.map((day, dayIndex) => {
                                const dayStr = formatDate(day);
                                const isToday = formatDate(day) === formatDate(new Date());

                                return (
                                    <div key={dayIndex} className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                                        <div className={`p-4 border-b border-slate-100 flex items-center gap-2 ${isToday ? 'bg-blue-50' : 'bg-slate-50'}`}>
                                            <h3 className={`font-bold text-lg capitalize ${isToday ? 'text-blue-700' : 'text-slate-700'}`}>
                                                {getDayLabel(day)}
                                            </h3>
                                            {isToday && (
                                                <span className="bg-blue-600 text-white text-[10px] uppercase font-bold px-2 py-0.5 rounded-full">Hoy</span>
                                            )}
                                        </div>

                                        <div className="overflow-x-auto">
                                            <table className="min-w-max w-full border-collapse">
                                                <thead>
                                                    <tr>
                                                        <th className="bg-white border-b border-r p-2 text-left w-24 text-slate-500 font-semibold text-xs uppercase tracking-wider">
                                                            Horario
                                                        </th>
                                                        {visibleEquipment.map(eq => (
                                                            <th key={eq.id} className="min-w-[160px] border-b border-r p-2 text-left bg-slate-50/50">
                                                                <div className="font-bold text-slate-800 text-xs">{eq.name}</div>
                                                                <div className="text-[10px] text-slate-500 leading-tight">{eq.type} - {eq.brand}</div>
                                                                <div className="text-[9px] text-slate-500 leading-tight">{eq.obj}</div>
                                                            </th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {TIME_SLOTS.map((slot) => {
                                                        // Visual separators for the 12:00-1:00 PM block
                                                        let rowClasses = "border-b border-r p-2 h-16 relative transition-all ";

                                                        if (slot.id === '12:00') rowClasses += "border-t-[3px] border-t-slate-300 ";
                                                        if (slot.id === '13:00') rowClasses += "border-t-[3px] border-t-slate-300 ";

                                                        return (
                                                            <tr key={slot.id}>
                                                                <td className={`bg-white border-b border-r p-2 text-xs font-mono text-slate-600 ${slot.id === '12:00' || slot.id === '13:00' ? 'border-t-[3px] border-t-slate-300' : ''}`}>
                                                                    {slot.label}
                                                                </td>
                                                                {visibleEquipment.map(eq => {
                                                                    const booking = getBookingForSlot(eq.id, slot.id, dayStr);
                                                                    const isSelected = isSlotSelected(eq.id, slot.id, dayStr);
                                                                    const isIndefinitelyBlocked = isSlotBlockedIndefinitely(eq.id, dayStr);
                                                                    const status = isIndefinitelyBlocked ? 'blocked' : (booking ? booking.status : 'available');
                                                                    const displayBooking = isIndefinitelyBlocked ? bookings.find(b => b.blockType === 'indefinite' && b.status === 'blocked' && (b.equipmentId === 0 || b.equipmentId === eq.id) && dayStr >= (b.blockStartDate || '')) : booking;

                                                                    return (
                                                                        <td
                                                                            key={eq.id}
                                                                            onClick={() => handleSlotClick(eq.id, slot.id, dayStr)}
                                                                            className={`${rowClasses} ${getCellColor(status, isSelected)}`}
                                                                        >
                                                                            <div className="h-full flex flex-col justify-center text-xs">
                                                                                {displayBooking && status === 'blocked' ? (
                                                                                    <div className="flex flex-col items-center opacity-60">
                                                                                        <Lock className="w-3 h-3 mb-0.5" />
                                                                                        <span className="text-center leading-tight text-[10px]">{displayBooking.blockedReason || 'No disponible'}</span>
                                                                                        {isIndefinitelyBlocked && <span className="text-center leading-tight text-[9px] mt-0.5">Indefinido</span>}
                                                                                    </div>
                                                                                ) : booking && status !== 'available' ? (
                                                                                    <div className="px-1">
                                                                                        <span className="font-bold block truncate text-[11px]">{booking.userName || 'Usuario'}</span>
                                                                                        <span className="block truncate opacity-80 text-[10px]">{booking.userGroup}</span>
                                                                                        <span className="block text-[9px] mt-0.5 opacity-70 uppercase tracking-tighter">{status === 'pending' ? 'En espera' : 'Aprobado'}</span>
                                                                                    </div>
                                                                                ) : isSelected ? (
                                                                                    <div className="flex items-center justify-center font-bold text-[10px]">
                                                                                        Seleccionado
                                                                                    </div>
                                                                                ) : (
                                                                                    <div className="flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity text-green-800 font-semibold text-[10px]">
                                                                                        Disponible
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
                ) : null}
            </main>

            {/* Booking Floating Action Button */}
            {selectedSlots.length > 0 && (
                <div className="fixed bottom-6 right-6 z-50 animate-bounce-small">
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-4 rounded-full shadow-2xl flex items-center gap-3 font-bold text-lg transition-transform hover:scale-105"
                    >
                        <span>Solicitar {selectedSlots.length} Turno(s)</span>
                        <div className="bg-white text-blue-600 rounded-full w-6 h-6 flex items-center justify-center text-xs">
                            {selectedSlots.length}
                        </div>
                    </button>
                </div>
            )}

            {/* Booking Modal */}
            <BookingModal
                isOpen={isModalOpen}
                selectedCount={selectedSlots.length}
                onClose={() => setIsModalOpen(false)}
                onSubmit={handleBookingSubmit}
                sampleEquipment={selectedSlots.length > 0 ? EQUIPMENT_LIST.find(e => e.id === selectedSlots[0].equipmentId) : undefined}
            />

            <footer className="bg-slate-100 border-t p-4 text-center text-slate-500 text-xs">
                &copy; {new Date().getFullYear()} Sala de Petrografía - Dirección de Geociencias Básicas.
            </footer>
        </div>
    );
};

export default App;
