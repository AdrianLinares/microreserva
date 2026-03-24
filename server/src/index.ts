import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import logger from './config/logger.js';
// Rutas
import bookingsRoutes from './routes/bookings.js';
import bookingRoutes from './routes/booking.js';
import bookingsSwapRoutes from './routes/bookingsSwap.js';
import settingsRoutes from './routes/settings.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ========================
// 1. MIDDLEWARES DE SEGURIDAD
// ========================
// Helmet añade encabezados HSTS, X-Frame-Options, No-Sniff, y Content-Security-Policy (CSP)
app.use(helmet({
    contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
}));

// CORS restrictivo para la intranet
const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',')
    : ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://granate.sgc.gov.co', 'https://granate.sgc.gov.co'];

app.use(cors({
    origin: (origin, callback) => {
        // Si estamos en entorno de desarrollo, flexibilizamos local o ips
        if (!origin || process.env.NODE_ENV !== 'production' || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            logger.warn(`Intento de acceso CORS bloqueado: ${origin}`);
            callback(new Error('Bloqueado por CORS Corporativo'));
        }
    },
    credentials: true
}));

app.use(express.json()); // Parsing de body application/json

// ========================
// 2. MONITOREO Y LOGS (MORGAN -> WINSTON)
// ========================
// Morgan para un log HTTP consolidado, mapeado a 'info' level de Winston
app.use(morgan('combined', {
    stream: {
        write: (message: string) => logger.info(message.trim())
    }
}));

// ========================
// 3. RUTAS API
// ========================
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Registrar routers aquí
app.use('/api/bookings', bookingsRoutes);
app.use('/api/booking', bookingRoutes);
app.use('/api/bookings-swap', bookingsSwapRoutes);
app.use('/api/settings', settingsRoutes);

// Error Middleware Global
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.error('Error no capturado en la ruta API', {
        url: req.url,
        method: req.method,
        error: err.message,
        stack: err.stack
    });

    res.status(500).json({
        error: 'Error Interno del Servidor',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Iniciamos el servidor
app.listen(PORT, () => {
    logger.info(`🚀 Servidor backend interno corriendo en el puerto ${PORT}`);
    logger.info(`🔍 Validar en: http://localhost:${PORT}/api/health`);
});
