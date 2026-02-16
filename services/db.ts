import { Booking, BookingStatus } from '../types';

const STORAGE_KEY = 'petro_reserva_bookings';
const SETTINGS_KEY = 'petro_reserva_settings';

export const getBookings = (): Booking[] => {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
};

export const saveBookings = (bookings: Booking[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bookings));
};

export const addBooking = (booking: Booking) => {
  const current = getBookings();
  // Simple validation to prevent duplicates
  const exists = current.find(b =>
    b.equipmentId === booking.equipmentId &&
    b.date === booking.date &&
    b.timeSlotId === booking.timeSlotId &&
    b.status !== 'available' // If it was cancelled/rejected effectively, we might overwrite, but let's assume strict checks
  );

  if (exists) {
    throw new Error('Este turno ya ha sido reservado o solicitado.');
  }

  const updated = [...current, booking];
  saveBookings(updated);
  return updated;
};

export const updateBookingStatus = (id: string, status: BookingStatus, extra?: Partial<Booking>) => {
  const current = getBookings();
  const updated = current.map(b => {
    if (b.id === id) {
      return { ...b, status, ...extra };
    }
    return b;
  });
  saveBookings(updated);
  return updated;
};

export const updateBookingDetails = (oldId: string, newDetails: { date: string, equipmentId: number, timeSlotId: string }) => {
  const bookings = getBookings();
  const oldBooking = bookings.find(b => b.id === oldId);
  if (!oldBooking) throw new Error("Reserva no encontrada");

  const newId = `${newDetails.date}-${newDetails.equipmentId}-${newDetails.timeSlotId}`;

  // If ID changed (moved slot), check for collision
  if (newId !== oldId) {
    const collision = bookings.find(b => b.id === newId && b.status !== 'available');
    if (collision) throw new Error("El horario y equipo seleccionados ya están ocupados.");
  }

  const updatedBookings = bookings.map(b => {
    if (b.id === oldId) {
      return {
        ...b,
        ...newDetails,
        id: newId // Update ID to match new slot parameters
      };
    }
    return b;
  });

  saveBookings(updatedBookings);
  return updatedBookings;
};

export const swapBookingSlots = (firstId: string, secondId: string) => {
  if (firstId === secondId) throw new Error("Seleccione reservas diferentes");

  const bookings = getBookings();
  const first = bookings.find(b => b.id === firstId);
  const second = bookings.find(b => b.id === secondId);

  if (!first || !second) throw new Error("Reserva no encontrada");
  if (first.status === 'blocked' || second.status === 'blocked') {
    throw new Error("No se pueden intercambiar reservas bloqueadas");
  }

  const firstNewId = `${second.date}-${second.equipmentId}-${second.timeSlotId}`;
  const secondNewId = `${first.date}-${first.equipmentId}-${first.timeSlotId}`;

  const collision = bookings.find(b =>
    (b.id === firstNewId && b.id !== firstId && b.id !== secondId) ||
    (b.id === secondNewId && b.id !== firstId && b.id !== secondId)
  );

  if (collision) throw new Error("El intercambio genera un conflicto de horario");

  const updated = bookings.map(b => {
    if (b.id === firstId) {
      return {
        ...b,
        date: second.date,
        equipmentId: second.equipmentId,
        timeSlotId: second.timeSlotId,
        id: firstNewId
      };
    }
    if (b.id === secondId) {
      return {
        ...b,
        date: first.date,
        equipmentId: first.equipmentId,
        timeSlotId: first.timeSlotId,
        id: secondNewId
      };
    }
    return b;
  });

  saveBookings(updated);
  return updated;
};

export const deleteBooking = (id: string) => {
  const current = getBookings();
  const updated = current.filter(b => b.id !== id);
  saveBookings(updated);
  return updated;
}

// Settings (Admin Notification Email)
export const getAdminSettings = () => {
  const data = localStorage.getItem(SETTINGS_KEY);
  return data ? JSON.parse(data) : { notificationEmail: '' };
}

export const saveAdminSettings = (settings: { notificationEmail: string }) => {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

// Mock date helper to get current week's Monday
export const getMondayOfCurrentWeek = (d: Date) => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
};

export const generateWeekDays = (weekOffset: number = 0): Date[] => {
  const today = new Date();
  const monday = getMondayOfCurrentWeek(today);

  // Add offset weeks (7 days * offset)
  monday.setDate(monday.getDate() + (weekOffset * 7));

  const days = [];
  for (let i = 0; i < 5; i++) {
    const nextDay = new Date(monday);
    nextDay.setDate(monday.getDate() + i);
    days.push(nextDay);
  }
  return days;
}