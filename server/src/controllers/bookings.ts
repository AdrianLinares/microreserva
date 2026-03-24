/**
 * CONTROLADOR DE RESERVAS (BOOKINGS)
 * ==================================
 * Este módulo gestiona las operaciones Core (CRUD) sobre las reservas y bloqueos:
 * 1. Obtención de slots disponibles/ocupados (GET)
 * 2. Creación de nuevas reservas comerciales o bloqueos del Administrador (POST)
 * 3. Actualización de estados o "Desbloqueo" físico mediante deletes de registros (PUT)
 * 4. Notificaciones automáticas corporativas por Nodemailer al crear/cancelar.
 */

import { Request, Response } from 'express';
import { query } from '../config/db.js';
import logger from '../config/logger.js';
import { sendEmail } from '../config/mailer.js';

interface DbBooking {
    id: string;
    equipment_id: number;
    date: string;
    time_slot_id: string;
    status: string;
    user_name?: string;
    user_email?: string;
    user_group?: string;
    blocked_reason?: string;
    block_type?: string;
    block_start_date?: string;
    block_end_date?: string;
    timestamp: number;
}

// Convertir camelCase (del frontend) a snake_case (de la bd)
const camelToSnake = (obj: any): any => {
    if (typeof obj !== 'object' || obj === null) return obj;
    if (Array.isArray(obj)) return obj.map(camelToSnake);
    return Object.fromEntries(
        Object.entries(obj).map(([key, value]) => [
            key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`),
            camelToSnake(value)
        ])
    );
};

export const getBookings = async (req: Request, res: Response): Promise<void> => {
    try {
        const { date, start_date, end_date, equipment_id, all_equipments, timestamp_gt } = req.query;

        // Construir query condicionada
        let text = 'SELECT * FROM bookings WHERE status != $1';
        const params: any[] = ['available']; // No mandamos los "available" marcadores
        let paramCount = 2;

        if (date) {
            text += ` AND date = $${paramCount++}`;
            params.push(date);
        } else if (start_date && end_date) {
            text += ` AND date >= $${paramCount++} AND date <= $${paramCount++}`;
            params.push(start_date, end_date);
        }

        if (equipment_id && !all_equipments) {
            text += ` AND equipment_id = $${paramCount++}`;
            params.push(Number(equipment_id));
        }

        if (timestamp_gt) {
            text += ` AND timestamp > $${paramCount++}`;
            params.push(Number(timestamp_gt));
        }

        text += ' ORDER BY created_at DESC';

        const result = await query(text, params);

        // Mapear de vuelta a camelCase para el frontend
        const rows = result.rows.map(row => ({
            id: row.id,
            equipmentId: row.equipment_id,
            date: row.date,
            timeSlotId: row.time_slot_id,
            status: row.status,
            userName: row.user_name,
            userEmail: row.user_email,
            userGroup: row.user_group,
            blockedReason: row.blocked_reason,
            blockType: row.block_type,
            blockStartDate: row.block_start_date,
            blockEndDate: row.block_end_date,
            timestamp: row.timestamp
        }));

        res.status(200).json(rows);
    } catch (error) {
        logger.error('Error fetching bookings', { error });
        res.status(500).json({ error: 'Error interno obteniendo reservaciones' });
    }
};

export const createBooking = async (req: Request, res: Response): Promise<void> => {
    try {
        const booking = req.body;

        if (!booking || !booking.id || !booking.equipmentId || !booking.date || !booking.timeSlotId || !booking.status) {
            res.status(400).json({ error: 'Missing required fields' });
            return;
        }

        // Validación de sobreescritura (no permitir si ya está pending/approved)
        const checkResult = await query(
            'SELECT id, status FROM bookings WHERE equipment_id = $1 AND date = $2 AND time_slot_id = $3',
            [booking.equipmentId, booking.date, booking.timeSlotId]
        );

        if (checkResult.rows.length > 0) {
            const existing = checkResult.rows[0];
            if (existing.status !== 'available') {
                res.status(409).json({ error: 'Time slot already booked or pending' });
                return;
            }
        }

        const snake = camelToSnake(booking);

        const insertQuery = `
            INSERT INTO bookings (
                id, equipment_id, date, time_slot_id, status, user_name, 
                user_email, user_group, blocked_reason, block_type, 
                block_start_date, block_end_date, timestamp
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            ON CONFLICT (id) DO UPDATE SET 
                equipment_id = EXCLUDED.equipment_id,
                date = EXCLUDED.date,
                time_slot_id = EXCLUDED.time_slot_id,
                status = EXCLUDED.status,
                user_name = EXCLUDED.user_name,
                user_email = EXCLUDED.user_email,
                user_group = EXCLUDED.user_group,
                blocked_reason = EXCLUDED.blocked_reason,
                block_type = EXCLUDED.block_type,
                block_start_date = EXCLUDED.block_start_date,
                block_end_date = EXCLUDED.block_end_date,
                timestamp = EXCLUDED.timestamp
        `;

        await query(insertQuery, [
            snake.id, snake.equipment_id, snake.date, snake.time_slot_id, snake.status,
            snake.user_name, snake.user_email, snake.user_group, snake.blocked_reason,
            snake.block_type, snake.block_start_date, snake.block_end_date, snake.timestamp
        ]);

        // Si es una solicitud nueva de usuario, enviar correo al usuario confirmando recepción
        if (booking.status === 'pending' && booking.userEmail && process.env.SMTP_HOST) {
            sendEmail({
                to: booking.userEmail,
                subject: 'Solicitud de Reserva Recibida - Sala de Petrografía SGC',
                html: `<p>Hola ${booking.userName},</p>
                        <p>Hemos recibido tu solicitud de reserva para el equipo ${booking.equipmentId} (Slot: ${booking.timeSlotId}) el día ${booking.date}.</p>
                        <p>Tu solicitud está en estado <strong>PENDIENTE</strong> de revisión por parte del administrador.</p>
                        <p>Recibirás un nuevo correo cuando sea aprobada o rechazada.</p>
                        <br>
                        <p>Atentamente,<br>Servicio Geológico Colombiano - Sala de Petrografía</p>`
            }).catch(err => logger.error('Error enviando email por background', err));
        }

        res.status(201).json({ success: true, id: booking.id });
    } catch (error) {
        logger.error('Error creating booking', { error });
        res.status(500).json({ error: 'Internal server error while creating booking' });
    }
};

export const updateBookingStatus = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { status } = req.body; // status, admin response...

        if (!status) {
            res.status(400).json({ error: 'Status is required' });
            return;
        }

        // Obtener el registro actual para el correo
        const record = await query('SELECT * FROM bookings WHERE id = $1', [id]);

        if (record.rows.length === 0) {
            res.status(404).json({ error: 'Booking not found' });
            return;
        }

        const currentBooking = record.rows[0];

        // Se puede hacer delete físico para liberar, o logical update.
        if (status === 'available') {
            await query('DELETE FROM bookings WHERE id = $1', [id]);
        } else if (status === 'blocked') {
            await query(`
                UPDATE bookings
                SET status = $1,
                    blocked_reason = COALESCE($2, blocked_reason),
                    block_type = COALESCE($3, block_type),
                    block_start_date = COALESCE($4, block_start_date),
                    block_end_date = COALESCE($5, block_end_date),
                    timestamp = $6
                WHERE id = $7
            `, [
                status,
                req.body.blockedReason ?? null,
                req.body.blockType ?? null,
                req.body.blockStartDate ?? null,
                req.body.blockEndDate ?? null,
                Date.now(),
                id
            ]);
        } else {
            await query(`
                UPDATE bookings 
                SET status = $1, 
                    blocked_reason = NULL,
                    block_type = NULL,
                    block_start_date = NULL,
                    block_end_date = NULL,
                    timestamp = $2 
                WHERE id = $3
            `, [status, Date.now(), id]);
        }

        // Notificar usuario de APROBACIÓN o RECHAZO (eliminado / available)
        if (currentBooking.user_email && process.env.SMTP_HOST) {
            if (status === 'approved') {
                sendEmail({
                    to: currentBooking.user_email,
                    subject: '✅ Reserva Aprobada - Sala de Petrografía SGC',
                    html: `<p>Hola ${currentBooking.user_name},</p>
                            <p>Tu solicitud de reserva para el equipo ${currentBooking.equipment_id} el día ${currentBooking.date} en el horario ${currentBooking.time_slot_id} ha sido <strong>APROBADA</strong>.</p>
                            <br>
                            <p>Atentamente,<br>Admin Sala de Petrografía</p>`
                });
            } else if (status === 'available') {
                sendEmail({
                    to: currentBooking.user_email,
                    subject: '❌ Reserva Rechazada o Cancelada - Sala de Petrografía SGC',
                    html: `<p>Hola ${currentBooking.user_name},</p>
                            <p>Tu solicitud de reserva para el equipo ${currentBooking.equipment_id} el día ${currentBooking.date} en el horario ${currentBooking.time_slot_id} ha sido <strong>rechazada o cancelada</strong>.</p>
                            <br>
                            <p>Atentamente,<br>Admin Sala de Petrografía</p>`
                });
            }
        }

        logger.info(`Booking ${id} status updated to ${status} by Admin`);
        res.status(200).json({ success: true });
    } catch (error) {
        logger.error('Error updating booking', { error });
        res.status(500).json({ error: 'Internal server error while updating booking' });
    }
};

export const deleteBooking = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = req.query.id as string;
        if (!id) {
            res.status(400).json({ error: 'Missing id parameter' });
            return;
        }
        await query('DELETE FROM bookings WHERE id = $1', [id]);
        res.status(200).json({ success: true });
    } catch (error) {
        logger.error('Error deleting booking', { error });
        res.status(500).json({ error: 'Internal server error' });
    }
};


export const updateBookingOrStatus = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = req.query.id as string;
        const body = req.body;

        if (!id) {
            res.status(400).json({ error: 'Missing id parameter' });
            return;
        }

        const record = await query('SELECT * FROM bookings WHERE id = $1', [id]);
        if (record.rows.length === 0) {
            res.status(404).json({ error: 'Booking not found' });
            return;
        }
        const currentBooking = record.rows[0];

        if (body.status) {
            let status = body.status;

            if (status === 'blocked') {
                await query(`
                    UPDATE bookings
                    SET status = $1,
                        blocked_reason = COALESCE($2, blocked_reason),
                        block_type = COALESCE($3, block_type),
                        block_start_date = COALESCE($4, block_start_date),
                        block_end_date = COALESCE($5, block_end_date),
                        timestamp = $6
                    WHERE id = $7
                `, [
                    status,
                    body.blockedReason ?? null,
                    body.blockType ?? null,
                    body.blockStartDate ?? null,
                    body.blockEndDate ?? null,
                    Date.now(),
                    id
                ]);
            } else {
                if (status === 'available') {
                    await query('DELETE FROM bookings WHERE id = $1', [id]);
                } else {
                    await query(`
                        UPDATE bookings
                        SET status = $1,
                            blocked_reason = NULL,
                            block_type = NULL,
                            block_start_date = NULL,
                            block_end_date = NULL,
                            timestamp = $2
                        WHERE id = $3
                    `, [status, Date.now(), id]);
                }
            }

            if (currentBooking.user_email && process.env.SMTP_HOST) {
                if (status === 'approved') {
                    sendEmail({
                        to: currentBooking.user_email,
                        subject: '✅ Reserva Aprobada - Sala de Petrografía SGC',
                        html: `<p>Hola ${currentBooking.user_name},</p>
                                <p>Tu solicitud de reserva para el equipo ${currentBooking.equipment_id} el día ${currentBooking.date} en el horario ${currentBooking.time_slot_id} ha sido <strong>APROBADA</strong>.</p>
                                <br>
                                <p>Atentamente,<br>Admin Sala de Petrografía</p>`
                    }).catch(() => { });
                } else if (status === 'available' || status === 'rejected') {
                    sendEmail({
                        to: currentBooking.user_email,
                        subject: '❌ Reserva Rechazada o Cancelada - Sala de Petrografía SGC',
                        html: `<p>Hola ${currentBooking.user_name},</p>
                                <p>Tu solicitud de reserva para el equipo ${currentBooking.equipment_id} el día ${currentBooking.date} en el horario ${currentBooking.time_slot_id} ha sido <strong>rechazada o cancelada</strong>.</p>
                                <br>
                                <p>Atentamente,<br>Admin Sala de Petrografía</p>`
                    }).catch(() => { });
                }
            }

            res.status(200).json({ success: true });
            return;
        }

        if (body.date && body.equipmentId !== undefined && body.timeSlotId) {
            const newId = `${body.date}-${body.equipmentId}-${body.timeSlotId}`;

            if (newId !== id) {
                const collision = await query('SELECT * FROM bookings WHERE id = $1', [newId]);
                if (collision.rows.length > 0) {
                    res.status(409).json({ error: 'El horario y equipo seleccionados ya están ocupados.' });
                    return;
                }

                await query(`
                    UPDATE bookings 
                    SET id = $1, 
                        date = $2, 
                        equipment_id = $3, 
                        time_slot_id = $4,
                        timestamp = $5
                    WHERE id = $6
                `, [newId, body.date, body.equipmentId, body.timeSlotId, Date.now(), id]);
            } else {
                await query(`
                    UPDATE bookings 
                    SET date = $1, 
                        equipment_id = $2, 
                        time_slot_id = $3,
                        timestamp = $4
                    WHERE id = $5
                `, [body.date, body.equipmentId, body.timeSlotId, Date.now(), id]);
            }

            res.status(200).json({ success: true, newId });
            return;
        }

        res.status(400).json({ error: 'Invalid request body' });
    } catch (error) {
        logger.error('Error updating booking status/details', { error });
        res.status(500).json({ error: 'Internal server error while updating booking' });
    }
};

