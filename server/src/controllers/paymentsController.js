const { createDemoPayment, confirmDemoPayment, listMyPayments } = require('../services/paymentService');
const { NotFound, Forbidden } = require('../middleware/errors');

async function createDemoCheckout(req, res) {
  const payment = await createDemoPayment(req.params.bookingId, req);
  // The client gets a demo payment sheet URL containing the booking id; no real
  // gateway. isDemo is always carried through so UI can label it.
  const { Booking: BookingModel } = require('../models/Booking');
  const booking = await BookingModel.findById(req.params.bookingId).select('reference price').lean();
  res.status(201).json({
    success: true,
    data: {
      isDemo: true,
      providerName: 'Roomly Demo Pay (simulation - no real money)',
      amountCents: payment.amount,
      currency: payment.currency,
      bookingRef: booking.reference,
      demoSheetUrl: `/checkout/${req.params.bookingId}/demo-sheet`,
      paymentId: payment._id,
    },
  });
}

async function confirmDemo(req, res) {
  const { result } = req.body || {};
  const out = await confirmDemoPayment(req.params.bookingId, result, req);
  res.json({
    success: true,
    data: {
      paymentStatus: out.payment.status,
      bookingStatus: out.booking.status,
      reference: out.booking.reference,
      isDemo: true,
      alreadyProcessed: !!out.alreadyProcessed,
    },
  });
}

async function myPayments(req, res) {
  return listMyPayments(req, res);
}

module.exports = { createDemoCheckout, confirmDemo, myPayments };
