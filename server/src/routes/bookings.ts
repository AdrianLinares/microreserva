import { Router } from 'express';
import { getBookings, createBooking, updateBookingStatus } from '../controllers/bookings.js';
import { adminAuthMiddleware } from '../middlewares/auth.js';

const router = Router();

// GET /api/bookings
router.get('/', getBookings);

// POST /api/bookings (Crear o bloquear reserva)
router.post('/', createBooking);

// PUT /api/bookings/:id/status (Aprobar, rechazar, etc - requiere ADMIN)
router.put('/:id/status', adminAuthMiddleware, updateBookingStatus);

export default router;
