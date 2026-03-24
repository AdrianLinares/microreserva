import { Router } from 'express';
import { swapBookings } from '../controllers/bookingsSwap.js';
import { adminAuthMiddleware } from '../middlewares/auth.js';

const router = Router();

// POST /api/bookings-swap
router.post('/', adminAuthMiddleware, swapBookings);

export default router;
