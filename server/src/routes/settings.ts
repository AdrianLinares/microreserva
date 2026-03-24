import { Router } from 'express';
import { getSettings, updateSettings } from '../controllers/settings.js';
import { adminAuthMiddleware, optionalAdminAuthMiddleware } from '../middlewares/auth.js';

const router = Router();

// GET /api/settings (Usa logica opcional, oculta informacion sensible si no es admin)
router.get('/', optionalAdminAuthMiddleware, getSettings);

// PUT /api/settings (Estrictamente admin para modificar defaults y notificaciones)
router.put('/', adminAuthMiddleware, updateSettings);

export default router;
