const { Booking } = require('../models/Booking');
const { Room } = require('../models/Room');
const availability = require('../services/availability');
const { ValidationError, NotFound, Forbidden, Conflict } = require('../middleware/errors');
const { newBookingReference } = require('../utils/tokens');
const { Notification } = require('../models/Notification');

const GUEST_VISIBLE = ['pending_payment', 'confirmed', 'cancellation_requested', 'cancelled', 'checked_in', 'checked_out', 'expired'];

async function createBooking(req, res) {
  const { roomId, checkIn, checkOut, guestCount } = req.body || {};
  if (!roomId || !checkIn || !checkOut || !guestCount) throw ValidationError('roomId, checkIn, checkOut and guestCount are required');
  if (!Number.isInteger(Number(guestCount)) || Number(guestCount) < 1) throw ValidationError('guestCount must be a positive integer');

  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  if (isNaN(checkInDate) || isNaN(checkOutDate)) throw ValidationError('Invalid dates');

  const room = await availability.validateBookingRequest({ roomId, checkIn: checkInDate, checkOut: checkOutDate, guestCount: Number(guestCount) });

  // Show any active overlap (pending included) to surface conflicts early for the UI.
  if (await availability.hasActiveOverlap(room._id, checkInDate, checkOutDate)) {
    throw Conflict('Selected dates are no longer available for this room');
  }

  const price = availability.computePriceBreakdown(room.roomCategory.basePrice, checkInDate, checkOutDate);

  const booking = await Booking.create({
    reference: newBookingReference(),
    guest: req.user._id,
    hotel: room.hotel,
    room: room._id,
    roomCategory: room.roomCategory._id,
    checkIn: checkInDate,
    checkOut: checkOutDate,
    guestCount: Number(guestCount),
    price,
    status: 'pending_payment',
    paymentStatus: 'unpaid',
    source: 'web',
  });

  await availability.claimNights(room._id, checkInDate, checkOutDate, booking._id);

  await Notification.create({
    user: req.user._id,
    type: 'booking_created',
    title: 'Reservation created',
    body: `Booking ${booking.reference} was created. Complete your payment to confirm it.`,
    data: { bookingId: booking._id, reference: booking.reference },
  });

  res.status(201).json({ success: true, data: { booking } });
}

async function listMyBookings(req, res) {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
  const filter = { guest: req.user._id };
  if (req.query.status) filter.status = { $in: String(req.query.status).split(',').filter((s) => GUEST_VISIBLE.includes(s)) };
  if (!req.query.status) filter.status = { $nin: ['expired'] };

  const [total, bookings] = await Promise.all([
    Booking.countDocuments(filter),
    Booking.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit)
      .populate('room', 'roomNumber')
      .populate('roomCategory', 'name images capacity amenities')
      .populate('hotel', 'name slug address contact'),
  ]);
  res.json({ success: true, data: { bookings, pagination: { total, page, limit, pages: Math.ceil(total / limit) } } });
}

async function getBooking(req, res) {
  const booking = await Booking.findById(req.params.bookingId)
    .populate('room', 'roomNumber')
    .populate('roomCategory', 'name images capacity amenities')
    .populate('hotel', 'name address.address');
  if (!booking) throw NotFound('Booking not found');

  const isOwner = String(booking.guest) === String(req.user._id);
  const isStaffOrBetter = ['staff', 'hotel_manager', 'admin'].includes(req.userRole);
  if (!isOwner && !isStaffOrBetter) throw Forbidden('You do not have access to this booking');
  res.json({ success: true, data: { booking } });
}

async function requestCancellation(req, res) {
  const booking = await Booking.findById(req.params.bookingId);
  if (!booking) throw NotFound('Booking not found');
  if (String(booking.guest) !== String(req.user._id)) throw Forbidden('Not your booking');

  const allowed = ['pending_payment', 'confirmed'];
  if (!allowed.includes(booking.status)) {
    throw ValidationError(`Booking in status '${booking.status}' cannot be cancelled`);
  }
  const requestedAt = new Date();
  booking.cancellation = {
    requestedAt,
    reason: (req.body && req.body.reason) || '',
    cancelledAt: booking.status === 'pending_payment' ? requestedAt : undefined, // unpaid auto-cancel
    cancelledBy: booking.status === 'pending_payment' ? req.user._id : undefined,
  };

  // Guests who already checked-in can no longer cancel.
  if (booking.status === 'cancellation_requested') {
    throw ValidationError('Cancellation already requested');
  }

  if (booking.status === 'pending_payment') {
    booking.status = 'cancelled';
  } else {
    booking.status = 'cancellation_requested';
  }
  await booking.save(); // releaseNights handled when staff approves or after pending cancel
  if (booking.status.startsWith('cancelled')) {
    await availability.releaseNights(booking._id);
  }

  await Notification.create({
    user: req.user._id,
    type: 'booking_cancelled',
    title: 'Cancellation recorded',
    body: `Booking ${booking.reference} cancellation status: ${booking.status}.`,
    data: { bookingId: booking._id, reference: booking.reference, status: booking.status },
  });

  res.json({ success: true, data: { booking } });
}

module.exports = { createBooking, listMyBookings, getBooking, requestCancellation };
