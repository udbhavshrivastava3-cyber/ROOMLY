const { Booking } = require('../models/Booking');
const { Room } = require('../models/Room');
const { RoomCategory } = require('../models/RoomCategory');
const mongoose = require('mongoose');
const env = require('../config/env');
const { ValidationError, Conflict } = require('../middleware/errors');

// Reservation occupies [checkIn, checkOut). Overlap condition:
//   existing.checkIn < requested.checkOut && existing.checkOut > requested.checkIn
const ACTIVE_FOR_AVAILABILITY = ['confirmed', 'checked_in', 'cancellation_requested', 'pending_payment'];

function dayBetweenUTC(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function eachNight(checkIn, checkOut) {
  const nights = [];
  let d = dayBetweenUTC(checkIn);
  const end = dayBetweenUTC(checkOut);
  while (d < end) {
    nights.push(new Date(d));
    d = new Date(d.getTime() + 24 * 3600 * 1000);
  }
  return nights;
}

// Indian GST on room rent, per-night basis (demo approximation of the
// room-rent slab rules): <= 7,500/night -> 0%; 7,501-74,999 -> 5%; >= 75,000 -> 12%.
// This is invoicing math only — no GSTIN is asserted and it is not tax advice.
function gstRateForNightlyRate(rate) {
  if (rate <= 7500) return 0;
  if (rate <= 74999) return 5;
  return 12;
}

// Standard nightly lookup: seasonal rates override base price for affected nights.
// SeasonalRate not implemented in v1; basePrice applies to every night (documented).
function computePriceBreakdown(basePrice, checkIn, checkOut) {
  const nights = eachNight(checkIn, checkOut).length;
  if (!nights) throw ValidationError('Check-out must be after check-in');
  const nightlyRate = basePrice;
  const baseSubtotal = nightlyRate * nights;
  const serviceCharge = Math.round(baseSubtotal * (env.serviceChargePct / 100) * 100) / 100;
  // Flat TAX_RATE_PCT override wins when set; otherwise use the GST slab of the per-night rent.
  const taxPct = env.taxRatePct !== null && !Number.isNaN(env.taxRatePct)
    ? env.taxRatePct
    : gstRateForNightlyRate(nightlyRate);
  const tax = Math.round(baseSubtotal * (taxPct / 100) * 100) / 100;
  const total = Math.round((baseSubtotal + serviceCharge + tax) * 100) / 100;
  return {
    nights,
    nightlyRate,
    baseSubtotal,
    serviceCharge,
    tax,
    total,
    currency: 'INR',
  };
}

function validateRoom(room) {
  if (!room || !room.active) throw httpError('Room not found or inactive', 404, 'NOT_FOUND');
  if (room.operationalStatus !== 'available') {
    throw httpError(`Room ${room.roomNumber} is not operational (${room.operationalStatus})`, 409, 'CONFLICT');
  }
  if (room.housekeepingStatus === 'maintenance') {
    throw httpError(`Room ${room.roomNumber} is undergoing maintenance`, 409, 'CONFLICT');
  }
}

function httpError(message, status, code) {
  const e = new Error(message);
  e.status = status; e.code = code;
  return e;
}

// Overlap check against the reservations of a room in the given window.
async function hasActiveOverlap(roomId, checkIn, checkOut, excludeBookingId = null) {
  const query = {
    room: roomId,
    status: { $in: ACTIVE_FOR_AVAILABILITY },
    checkIn: { $lt: checkOut },
    checkOut: { $gt: checkIn },
  };
  if (excludeBookingId) query._id = { $ne: excludeBookingId };
  const n = await Booking.countDocuments(query);
  return n > 0;
}

// List which rooms of a hotel/category are free for a stay.
async function availableRooms(hotelId, checkIn, checkOut, opts = {}) {
  const rooms = await Room.find({ hotel: hotelId, active: true, operationalStatus: 'available', housekeepingStatus: { $ne: 'maintenance' } })
    .populate('roomCategory')
    .lean();
  const busyRooms = await Booking.find({
    hotel: hotelId,
    status: { $in: ACTIVE_FOR_AVAILABILITY },
    checkIn: { $lt: checkOut },
    checkOut: { $gt: checkIn },
  }).distinct('room');
  const busy = new Set(busyRooms.map(String));
  return rooms.filter((r) => !busy.has(String(r._id))).filter((r) => r.roomCategory.active);
}

const BookingNightLock = mongoose.models && mongoose.models.BookingNightLock
  ? mongoose.models.BookingNightLock
  : mongoose.model('BookingNightLock', new mongoose.Schema({
      room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true, index: true },
      night: { type: Date, required: true, index: true },
      booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
    }));

let nightIndexReady = null; // memoized promise; awaited by claimNights
function ensureNightIndex() {
  if (!nightIndexReady) nightIndexReady = BookingNightLock.collection.createIndex({ room: 1, night: 1 }, { unique: true });
  return nightIndexReady;
}

// Atomically claim every night of [checkIn, checkOut) for the room. A unique index
// on (room, night) makes concurrent double-bookings impossible even without a
// replica-set transaction. Any duplicate key error surfaces as a CONFLICT.
async function claimNights(roomId, checkIn, checkOut, bookingId) {
  await ensureNightIndex();
  const nights = eachNight(checkIn, checkOut);
  if (nights.length === 0) throw ValidationError('Check-out must be after check-in');
  try {
    await BookingNightLock.insertMany(
      nights.map((night) => ({ room: roomId, night, booking: bookingId })),
      { ordered: false }
    );
  } catch (err) {
    // Ordered insertMany may partially insert; clean up its own booking claim.
    await BookingNightLock.deleteMany({ booking: bookingId });
    if (err.code === 11000) throw Conflict('This room is no longer available for the selected dates');
    throw err;
  }
}

// Release night locks - call when a booking is cancelled/expired.
async function releaseNights(bookingId) {
  await BookingNightLock.deleteMany({ booking: bookingId });
}

async function validateBookingRequest({ roomId, checkIn, checkOut, guestCount, excludeBookingId }) {
  const room = await Room.findById(roomId).populate('roomCategory');
  if (!room || !room.active) throw NotFoundRoom();
  validateRoom(room);

  if (checkOut <= checkIn) throw ValidationError('Check-out must be after check-in');
  const maxStayDays = 30 * 6; // six-month upper bound on a stay
  if ((new Date(checkOut) - new Date(checkIn)) / 86400000 > maxStayDays) {
    throw ValidationError('Stay length is too long (max 180 nights)');
  }
  if (new Date(checkIn) < dayBetweenUTC(new Date())) throw ValidationError('Check-in date cannot be in the past');

  if (guestCount > room.roomCategory.capacity) {
    throw ValidationError(`Room capacity is ${room.roomCategory.capacity}, requested ${guestCount}`);
  }

  return room;
}

module.exports = {
  BookingNightLock,
  computePriceBreakdown,
  hasActiveOverlap,
  availableRooms,
  claimNights,
  releaseNights,
  validateBookingRequest,
  eachNight,
  ACTIVE_FOR_AVAILABILITY,
};
