const fs = require('fs');
const content = fs.readFileSync('server/src/controllers/bookings.ts', 'utf8');

// The exported updateBookingStatus that expects a status from req.body and id from params
// We will modify the new updateBookingOrStatus to send emails.

const codeToAddCode = `
        const record = await query('SELECT * FROM bookings WHERE id = $1', [id]);
        if (record.rows.length === 0) {
            res.status(404).json({ error: 'Booking not found' });
            return;
        }
        const currentBooking = record.rows[0];
`

console.log('Script dry run OK');
