const fs = require('fs');

let code = fs.readFileSync('server/src/controllers/bookings.ts', 'utf8');

// We'll replace the updateBookingOrStatus entirely with one that sends emails.
const replacement = `
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
                await query(\`
                    UPDATE bookings
                    SET status = $1,
                        blocked_reason = COALESCE($2, blocked_reason),
                        block_type = COALESCE($3, block_type),
                        block_start_date = COALESCE($4, block_start_date),
                        block_end_date = COALESCE($5, block_end_date),
                        timestamp = $6
                    WHERE id = $7
                \`, [
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
                    await query(\`
                        UPDATE bookings
                        SET status = $1,
                            blocked_reason = NULL,
                            block_type = NULL,
                            block_start_date = NULL,
                            block_end_date = NULL,
                            timestamp = $2
                        WHERE id = $3
                    \`, [status, Date.now(), id]);
                }
            }

            if (currentBooking.user_email && process.env.SMTP_HOST) {
                if (status === 'approved') {
                    sendEmail({
                        to: currentBooking.user_email,
                        subject: '✅ Reserva Aprobada - Sala de Petrografía SGC',
                        html: \`<p>Hola \${currentBooking.user_name},</p>
                                <p>Tu solicitud de reserva para el equipo \${currentBooking.equipment_id} el día \${currentBooking.date} en el horario \${currentBooking.time_slot_id} ha sido <strong>APROBADA</strong>.</p>
                                <br>
                                <p>Atentamente,<br>Admin Sala de Petrografía</p>\`
                    }).catch(() => {});
                } else if (status === 'available' || status === 'rejected') {
                    sendEmail({
                        to: currentBooking.user_email,
                        subject: '❌ Reserva Rechazada o Cancelada - Sala de Petrografía SGC',
                        html: \`<p>Hola \${currentBooking.user_name},</p>
                                <p>Tu solicitud de reserva para el equipo \${currentBooking.equipment_id} el día \${currentBooking.date} en el horario \${currentBooking.time_slot_id} ha sido <strong>rechazada o cancelada</strong>.</p>
                                <br>
                                <p>Atentamente,<br>Admin Sala de Petrografía</p>\`
                    }).catch(() => {});
                }
            }

            res.status(200).json({ success: true });
            return;
        }

        if (body.date && body.equipmentId !== undefined && body.timeSlotId) {
            const newId = \`\${body.date}-\${body.equipmentId}-\${body.timeSlotId}\`;

            if (newId !== id) {
                const collision = await query('SELECT * FROM bookings WHERE id = $1', [newId]);
                if (collision.rows.length > 0) {
                    res.status(409).json({ error: 'El horario y equipo seleccionados ya están ocupados.' });
                    return;
                }

                await query(\`
                    UPDATE bookings 
                    SET id = $1, 
                        date = $2, 
                        equipment_id = $3, 
                        time_slot_id = $4,
                        timestamp = $5
                    WHERE id = $6
                \`, [newId, body.date, body.equipmentId, body.timeSlotId, Date.now(), id]);
            } else {
                await query(\`
                    UPDATE bookings 
                    SET date = $1, 
                        equipment_id = $2, 
                        time_slot_id = $3,
                        timestamp = $4
                    WHERE id = $5
                \`, [body.date, body.equipmentId, body.timeSlotId, Date.now(), id]);
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
`;

code = code.replace(/export const updateBookingOrStatus = async[\s\S]*?^};$/m, replacement);
fs.writeFileSync('server/src/controllers/bookings.ts', code);
