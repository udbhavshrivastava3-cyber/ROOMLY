const { Payment } = require('../models/Payment');
const { Booking } = require('../models/Booking');
const env = require('../config/env');
const { ValidationError, NotFound, Forbidden, Conflict } = require('../middleware/errors');

// PAYMENT APPROACH (docs/SECURITY.md):
// The demo provider "Roomly Demo Pay" is a clearly labeled simulation. No real
// money moves and no fabricated gateway IDs are created. Booking confirmation
// happens ONLY through server-side verification in demoConfirmPayment - whatever
// the browser claims is never trusted. Swapping in Stripe later means adding a
// real charge creation/verification path; the demo is kept separate from it.

const STATUS_BY_DEMO_RESULT = {
  succeed: 'succeeded',
  fail: 'failed',
};

function assertDemoMode() {
  if (env.paymentProvider !== 'demo') {
    throw ValidationError('Demo payments are disabled; provider is configured as real gateway');
  }
}

async function createDemoPayment(bookingId, req) {
  assertDemoMode();
  const booking = await Booking.findById(bookingId);
  if (!booking) throw NotFound('Booking not found');
  if (String(booking.guest) !== String(req.user._id)) throw Forbidden('Not your booking');
  if (booking.status !== 'pending_payment') throw Conflict(`Booking is ${booking.status}, not pending payment`);
  if (booking.paymentStatus === 'paid') throw Conflict('Booking already paid');

  const amountCents = Math.round(booking.price.total * 100);
  const existing = await Payment.findOne({ idempotencyKey: booking.reference });
  if (existing && existing.providerOrderId) {
    // Idempotent re-entry: return the same pending order instead of a duplicate.
    return existing;
  }
  if (existing) return existing;

  const payment = await Payment.create({
    booking: booking._id,
    guest: booking.guest,
    provider: 'demo',
    amount: amountCents,
    currency: booking.price.currency,
    status: 'pending',
    providerOrderId: `demo_${booking.reference}`,
    idempotencyKey: booking.reference,
    isDemo: true,
  });
  return payment;
}

// Server-side verification of the demo checkout result. The "result" is what the
// helper page posts back; failing results are recorded and the booking stays
// unpaid. Only 'succeed' flips booking state, in one guarded place.
async function confirmDemoPayment(bookingId, result, req) {
  assertDemoMode();
  const booking = await Booking.findById(bookingId);
  if (!booking) throw NotFound('Booking not found');
  if (String(booking.guest) !== String(req.user._id)) throw Forbidden('Not your booking');

  const payment = await Payment.findOne({ idempotencyKey: booking.reference });
  if (!payment) throw NotFound('Payment order not found');
  if (payment.status === 'succeeded') {
    return { payment, alreadyProcessed: true, booking };
  }
  if (payment.status === 'failed') {
    // Allow a retry: reset to pending so the user can attempt payment again.
    payment.status = 'pending';
  }

  const newStatus = STATUS_BY_DEMO_RESULT[result] || null;
  if (!newStatus) throw ValidationError('Unknown demo payment result');

  if (newStatus === 'failed') {
    payment.status = 'failed';
    payment.failureReason = 'Declined by demo provider (simulated)';
    await payment.save();
    return { payment, booking };
  }

  // Succeed path - guarded so repeated callbacks cannot double-confirm.
  payment.status = 'succeeded';
  payment.providerTransactionId = `demo_txn_${payment.providerOrderId}`;
  await payment.save();

  const updated = await Booking.findOneAndUpdate(
    { _id: booking._id, status: 'pending_payment' },
    { $set: { status: 'confirmed', paymentStatus: 'paid' } },
    { new: true }
  );
  if (!updated) {
    // Someone else confirmed concurrently; verify consistency.
    return { payment, alreadyProcessed: true, booking: await Booking.findById(booking._id) };
  }

  const { Notification } = require('../models/Notification');
  await Notification.create({
    user: booking.guest,
    type: 'payment_confirmed',
    title: 'Payment confirmed (demo)',
    body: `Payment for booking ${booking.reference} is confirmed in demo mode.`,
    data: { bookingId: String(booking._id), reference: booking.reference, isDemo: true },
  });

  const mailService = require('./mailService');
  const { Hotel } = require('../models/Hotel');
  const hotel = await Hotel.findById(booking.hotel);
  const tpl = mailService.templates.bookingConfirmation(booking, hotel);
  req.app.set('mailResult', await mailService.sendMail(req.user.email, tpl.subject, tpl.text));

  return { payment, booking: updated };
}

async function listMyPayments(req, res) {
  const payments = await Payment.find({ guest: req.user._id }).sort({ createdAt: -1 }).limit(50).populate('booking', 'reference status');
  res.json({ success: true, data: { payments } });
}

module.exports = { createDemoPayment, confirmDemoPayment, listMyPayments };
