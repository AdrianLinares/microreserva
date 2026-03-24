import { Router } from 'express';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { updateBookingOrStatus, deleteBooking } from '../controllers/bookings.js';

const router = Router();

router.put('/', adminAuthMiddleware, updateBookingOrStatus);
router.delete('/', adminAuthMiddleware, deleteBooking);

export default router;
