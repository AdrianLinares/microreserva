import { Request, Response } from 'express';
import { query } from '../config/db.js';
import logger from '../config/logger.js';

interface SwapPayload {
    firstId: string;
    secondId: string;
}

export const swapBookings = async (req: Request, res: Response): Promise<void> => {
    // Iniciar transacción explíctamente
    const { pool } = await import('../config/db.js');
    const client = await pool.connect();

    try {
        const payload: SwapPayload = req.body;

        if (!payload.firstId || !payload.secondId) {
            res.status(400).json({ error: 'Missing firstId or secondId' });
            return;
        }

        if (payload.firstId === payload.secondId) {
            res.status(400).json({ error: 'Seleccione reservas diferentes' });
            return;
        }

        await client.query('BEGIN'); // Transacción segura

        const firstResult = await client.query('SELECT * FROM bookings WHERE id = $1 FOR UPDATE', [payload.firstId]);
        const secondResult = await client.query('SELECT * FROM bookings WHERE id = $1 FOR UPDATE', [payload.secondId]);

        if (firstResult.rows.length === 0 || secondResult.rows.length === 0) {
            res.status(404).json({ error: 'Reserva no encontrada' });
            await client.query('ROLLBACK');
            return;
        }

        const firstBooking = firstResult.rows[0];
        const secondBooking = secondResult.rows[0];

        if (firstBooking.status === 'blocked' || secondBooking.status === 'blocked') {
            res.status(400).json({ error: 'No se pueden intercambiar reservas bloqueadas' });
            await client.query('ROLLBACK');
            return;
        }

        const firstNewId = `${secondBooking.date}-${secondBooking.equipment_id}-${secondBooking.time_slot_id}`;
        const secondNewId = `${firstBooking.date}-${firstBooking.equipment_id}-${firstBooking.time_slot_id}`;

        const collisionCheck = await client.query(
            'SELECT * FROM bookings WHERE id IN ($1, $2) AND id NOT IN ($3, $4)',
            [firstNewId, secondNewId, payload.firstId, payload.secondId]
        );

        if (collisionCheck.rows.length > 0) {
            res.status(409).json({ error: 'El intercambio genera un conflicto de horario' });
            await client.query('ROLLBACK');
            return;
        }

        const tmpId = `__tmp_${payload.firstId}_${Date.now()}`;

        // 1. Mover primero a temporal
        await client.query('UPDATE bookings SET id = $1 WHERE id = $2', [tmpId, payload.firstId]);

        // 2. Mover segundo al original del primero
        await client.query(
            `UPDATE bookings SET id = $1, date = $2, equipment_id = $3, time_slot_id = $4 WHERE id = $5`,
            [firstNewId, firstBooking.date, firstBooking.equipment_id, firstBooking.time_slot_id, payload.secondId]
        );

        // 3. Mover temporal al original del segundo
        await client.query(
            `UPDATE bookings SET id = $1, date = $2, equipment_id = $3, time_slot_id = $4 WHERE id = $5`,
            [secondNewId, secondBooking.date, secondBooking.equipment_id, secondBooking.time_slot_id, tmpId]
        );

        await client.query('COMMIT');

        logger.info(`Reservas intercambiadas con éxito: ${payload.firstId} <-> ${payload.secondId}`);
        res.status(200).json({ success: true });
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('Error swapping bookings', { error });
        res.status(500).json({ error: 'Internal server error while swapping bookings' });
    } finally {
        client.release();
    }
};
