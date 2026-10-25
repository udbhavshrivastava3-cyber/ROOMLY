const nodemailer = require('nodemailer');
const env = require('../config/env');

let transporter = null;
if (env.smtp.host && env.smtp.user) {
  transporter = nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.port === 465,
    auth: { user: env.smtp.user, pass: env.smtp.pass },
  });
}

// Templates keep content plain but professional; contains no secrets/passwords.
const templates = {
  bookingConfirmation: (booking, hotel) => ({
    subject: `Your Roomly booking ${booking.reference} is confirmed`,
    text:
`Dear guest,

Your reservation at ${hotel.name} is confirmed.

Booking reference: ${booking.reference}
Check-in:  ${new Date(booking.checkIn).toISOString().slice(0, 10)}
Check-out: ${new Date(booking.checkOut).toISOString().slice(0, 10)}
Total: ${booking.price.total.toFixed(2)} ${booking.price.currency}

We look forward to welcoming you.

The Roomly Team`,
  }),
  cancellationUpdate: (booking, hotel, refunded) => ({
    subject: `Booking ${booking.reference} cancelled`,
    text: `Your booking ${booking.reference} at ${hotel.name} has been cancelled.${refunded ? ' A refund refund request has been recorded (demo mode: no real funds move).' : ''}\n\nThe Roomly Team`,
  }),
};

// Never logs passwords/tokens. Records actual send result - returns {sent, provider, error}.
async function sendMail(to, subject, text) {
  if (!transporter) {
    console.log(`[mail:dev-transport] To: ${to} | Subject: ${subject} | (SMTP not configured; message not sent)`);
    return { sent: false, provider: 'dev-log' };
  }
  try {
    const info = await transporter.sendMail({ from: env.smtp.from, to, subject, text });
    return { sent: true, provider: 'smtp', messageId: info.messageId };
  } catch (err) {
    console.error('[mail] send failed:', err.message);
    return { sent: false, provider: 'smtp', error: err.message };
  }
}

module.exports = { sendMail, templates };
