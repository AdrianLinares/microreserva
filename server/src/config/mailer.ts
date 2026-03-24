import nodemailer from 'nodemailer';
import logger from './logger.js';

// Transporter para el relay SMTP Corporativo
export const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
    tls: {
        // Para redes internas corporativas podría necesitarse permitir certificados autofirmados
        rejectUnauthorized: process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== 'false',
    },
});

// Función centralizada para enviar correos
export const sendEmail = async ({ to, subject, text, html }: { to: string; subject: string; text?: string; html?: string }) => {
    try {
        const info = await transporter.sendMail({
            from: `"${process.env.SMTP_FROM_NAME || 'Sistema de Reservas'}" <${process.env.SMTP_FROM_EMAIL || 'no-reply@sgc.gov.co'}>`,
            to,
            subject,
            text,
            html,
        });

        logger.info(`Email enviado a ${to}`, { messageId: info.messageId });
        return info;
    } catch (error) {
        logger.error('Error enviando correo SMTP corporativo', { error, to, subject });
        // En escenarios corporativos puede no lanzarse error para no colapsar la app, pero es clave registrarlo
        return null;
    }
};
