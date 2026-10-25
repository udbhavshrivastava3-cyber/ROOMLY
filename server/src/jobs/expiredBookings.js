const { Booking } = require('../models/Booking');

const EXPIRY_MINUTES = 30;

// Pending payment bookings older than EXPIRY_MINUTES are expired so their room
// inventory is freed. Idempotent: status flips only from pending_payment.
function startExpiredBookingJob() {
  const tick = async () => {
    try {
      const cutoff = new Date(Date.now() - EXPIRY_MINUTES * 60 * 1000);
      const result = await Booking.updateMany(
        { status: 'pending_payment', createdAt: { $lt: cutoff } },
        { $set: { status: 'expired', expiresAt: new Date() } }
      );
      if (result.modifiedCount > 0) console.log(`[jobs] expired ${result.modifiedCount} pending bookings`);
    } catch (err) {
      console.error('[jobs] expiry tick failed:', err.message);
    }
  };
  // In tests the interval must not keep the process alive: unref it.
  const interval = setInterval(tick, 5 * 60 * 1000);
  interval.unref?.();
  tick();
  return () => clearInterval(interval);
}

module.exports = { startExpiredBookingJob, EXPIRY_MINUTES };
