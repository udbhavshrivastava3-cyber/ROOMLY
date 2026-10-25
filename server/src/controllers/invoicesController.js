const { Booking } = require('../models/Booking');
const { Payment } = require('../models/Payment');
const { Hotel } = require('../models/Hotel');
const { User } = require('../models/User');
const { NotFound, Forbidden } = require('../middleware/errors');

// Invoice number is deterministic per booking: RLM-INV-<booking ref sequence>
function invoiceNumberFor(reference) {
  return `RLM-INV-${reference.replace('RLM-', '')}`;
}

async function getInvoice(req, res) {
  const booking = await Booking.findById(req.params.bookingId).populate('room', 'roomNumber').populate('roomCategory', 'name');
  if (!booking) throw NotFound('Booking not found');

  const isOwner = String(booking.guest) === String(req.user._id);
  const canOperate = ['staff', 'hotel_manager', 'admin'].includes(req.userRole);
  if (!isOwner && !canOperate) throw Forbidden('No access to this invoice');

  // Only a VERIFIED succeeded payment justifies a paid invoice.
  const payment = await Payment.findOne({ booking: booking._id }).sort({ createdAt: 1 });
  const paid = !!(payment && payment.status === 'succeeded');

  const hotel = await Hotel.findById(booking.hotel).lean();
  const guest = await User.findById(booking.guest).select('name email').lean();

  res.json({
    success: true,
    data: {
      invoice: {
        invoiceNumber: invoiceNumberFor(booking.reference),
        issuedAt: new Date().toISOString(),
        hotel: { name: hotel.name, address: `${hotel.address?.city || ''}, ${hotel.address?.country || ''}`.trim() },
        guest: { name: guest.name, email: guest.email },
        booking: {
          reference: booking.reference,
          status: booking.status,
          roomNumber: booking.room?.roomNumber,
          categoryName: booking.roomCategory?.name,
          checkIn: booking.checkIn,
          checkOut: booking.checkOut,
          guestCount: booking.guestCount,
        },
        price: booking.price,
        payment: paid
          ? {
              provider: payment.isDemo ? `${payment.provider} (simulation)` : payment.provider,
              status: payment.status,
              amountCents: payment.amount,
              currency: payment.currency,
              paidAt: payment.updatedAt,
            }
          : {
              provider: payment?.provider || 'none',
              status: payment?.status || 'unpaid',
              note: 'Invoice reflects an UNPAID booking - no payment succeeded yet.',
            },
        paymentOutcome: paid ? 'PAID' : 'UNPAID',
      },
    },
  });
}

module.exports = { getInvoice, invoiceNumberFor };
