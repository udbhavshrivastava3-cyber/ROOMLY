const { Booking } = require('../models/Booking');
const { Payment } = require('../models/Payment');
const { Room } = require('../models/Room');
const { Hotel } = require('../models/Hotel');
const { Forbidden, ValidationError } = require('../middleware/errors');
const { staffCanAccessHotel } = require('./operationsController');

function parseWindow(req) {
  const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 1), 365);
  const end = new Date();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  return { start, end: new Date(end.getTime() + 24 * 3600 * 1000), days };
}

// METRICS (defined in docs/API_DOCUMENTATION.md):
//  - grossBookingValue: sum of confirmed+checked_in+checked_out+cancelled-bookings' totals
//  - collected: sum of succeeded payments (paid, net before refund)
//  - pendingPayment: sum of pending_payment booking totals
//  - refunded: refund_processing/payment refunded amounts
async function hotelReport(req, res) {
  const { hotelId } = req.params;
  if (!(await staffCanAccessHotel(req, hotelId))) throw Forbidden('Not authorized for this hotel');
  const { start, end, days } = parseWindow(req);

  // aggregate() does not cast strings to ObjectId (unlike find()) — cast explicitly.
  const hotelOid = new (require('mongoose').Types.ObjectId)(hotelId);
  const match = { hotel: hotelOid, createdAt: { $gte: start, $lt: end } };
  const bookingsByDay = await Booking.aggregate([
    { $match: match },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 }, value: { $sum: '$price.total' } } },
    { $sort: { _id: 1 } },
  ]);
  const byStatus = await Booking.aggregate([
    { $match: match },
    { $group: { _id: '$status', count: { $sum: 1 }, value: { $sum: '$price.total' } } },
  ]);
  const payments = await Payment.aggregate([
    { $match: { booking: { $exists: true }, createdAt: { $gte: start, $lt: end } } },
    { $lookup: { from: 'bookings', localField: 'booking', foreignField: '_id', as: 'b' } },
    { $unwind: '$b' },
    { $match: { 'b.hotel': hotelOid } },
    { $group: { _id: '$status', count: { $sum: 1 }, amountCents: { $sum: '$amount' } } },
  ]);

  const rooms = await Room.find({ hotel: hotelId }).lean();
  const occupied = rooms.filter((r) => r.operationalStatus === 'occupied').length;
  const occupancy = rooms.length ? Math.round((occupied / rooms.length) * 100) : 0;

  const grossBookingValue = byStatus.filter((s) => ['confirmed', 'checked_in', 'checked_out'].includes(s._id))
    .reduce((sum, s) => sum + s.value, 0);
  const collected = payments.filter((p) => p._id === 'succeeded').reduce((s, p) => s + p.amountCents, 0) / 100;

  res.json({
    success: true,
    data: {
      windowDays: days,
      bookingsByDay,
      byStatus,
      payments,
      occupancy: { occupied, totalRooms: rooms.length, pct: occupancy },
      metrics: {
        grossBookingValue: Math.round(grossBookingValue * 100) / 100,
        collected: Math.round(collected * 100) / 100,
        currency: 'INR',
        note: 'collected = succeeded payments; grossBookingValue = sum of confirmed+checked_in+checked_out totals.',
      },
    },
  });
}

async function adminOverview(req, res) {
  if (req.userRole !== 'admin') throw Forbidden('Administrators only');
  const { start, end, days } = parseWindow(req);
  const [users, hotels, payments, activeBookings] = await Promise.all([
    require('../models/User').User.countDocuments({}),
    Hotel.countDocuments({}),
    Payment.aggregate([
      { $match: { createdAt: { $gte: start, $lt: end } } },
      { $group: { _id: '$status', count: { $sum: 1 }, amountCents: { $sum: '$amount' } } },
    ]),
    Booking.countDocuments({ status: { $in: ['confirmed', 'checked_in'] } }),
  ]);
  const byStatus = await Booking.aggregate([
    { $match: { createdAt: { $gte: start, $lt: end } } },
    { $group: { _id: '$status', count: { $sum: 1 }, value: { $sum: '$price.total' } } },
  ]);
  const bookingsByDay = await Booking.aggregate([
    { $match: { createdAt: { $gte: start, $lt: end } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 }, value: { $sum: '$price.total' } } },
    { $sort: { _id: 1 } },
  ]);
  const collected = payments.filter((p) => p._id === 'succeeded').reduce((s, p) => s + p.amountCents, 0) / 100;

  res.json({
    success: true,
    data: {
      windowDays: days,
      counters: { users, hotels, activeBookings },
      byStatus, bookingsByDay, payments,
      metrics: {
        collected: Math.round(collected * 100) / 100,
        currency: 'INR',
        note: 'collected = succeeded payments only.',
      },
    },
  });
}

module.exports = { hotelReport, adminOverview };
