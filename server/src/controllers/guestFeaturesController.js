const { Review } = require('../models/Review');
const { Notification } = require('../models/Notification');
const { ServiceRequest, SERVICE_TYPES } = require('../models/ServiceRequest');
const { Booking } = require('../models/Booking');
const { NotFound, Forbidden, ValidationError, Conflict } = require('../middleware/errors');
const { ACTIVE_FOR_AVAILABILITY } = require('../services/availability');

// ---- Reviews (one per booking, eligible stay required) ----
async function createReview(req, res) {
  const booking = await Booking.findById(req.body.bookingId);
  if (!booking) throw NotFound('Booking not found');
  if (String(booking.guest) !== String(req.user._id)) throw Forbidden('Not your booking');
  const now = new Date();
  if (booking.status !== 'checked_out' || booking.checkOut > now) {
    throw ValidationError('Reviews are only allowed after a completed stay');
  }
  const { rating, comment, title } = req.body || {};
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw ValidationError('rating must be 1-5');
  if (!comment || comment.trim().length < 10) throw ValidationError('comment must be at least 10 characters');

  const existing = await Review.findOne({ booking: booking._id });
  if (existing) throw Conflict('Only one review per booking is allowed');

  const review = await Review.create({
    booking: booking._id, guest: req.user._id, hotel: booking.hotel, roomCategory: booking.roomCategory,
    rating, title: (title || '').slice(0, 120), comment,
  });
  res.status(201).json({ success: true, data: { review } });
}

async function listHotelReviews(req, res) {
  const reviews = await Review.find({ hotel: req.params.hotelId, status: 'published' })
    .sort('-createdAt').limit(20).populate('guest', 'name');
  const agg = await Review.aggregate([
    { $match: { hotel: require('mongoose').Types.ObjectId.createFromHexString(req.params.hotelId), status: 'published' } },
    { $group: { _id: '$hotel', avgRating: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  res.json({ success: true, data: { reviews, summary: agg[0] || { avgRating: null, count: 0 } } });
}

// ---- Notifications ----
async function myNotifications(req, res) {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
  const filter = { user: req.user._id };
  if (req.query.unread === 'true') filter.readAt = null;
  const [total, notifications] = await Promise.all([
    Notification.countDocuments(filter),
    Notification.find(filter).sort('-createdAt').skip((page - 1) * limit).limit(limit),
  ]);
  res.json({ success: true, data: { notifications, pagination: { total, page, limit, pages: Math.ceil(total / limit) } } });
}

async function markNotificationRead(req, res) {
  const n = await Notification.findOneAndUpdate(
    { _id: req.params.notificationId, user: req.user._id },
    { readAt: new Date() },
    { new: true }
  );
  if (!n) throw NotFound('Notification not found');
  res.json({ success: true, data: { notification: n } });
}

// ---- Service requests (guest submits for an active stay) ----
async function createServiceRequest(req, res) {
  const { type, description, bookingId } = req.body || {};
  if (!SERVICE_TYPES.includes(type)) throw ValidationError(`type must be one of: ${SERVICE_TYPES.join(', ')}`);
  if (!description || description.trim().length < 5) throw ValidationError('description required (min 5 chars)');

  let hotelId;
  if (bookingId) {
    const booking = await Booking.findOne({ _id: bookingId, guest: req.user._id });
    if (!booking) throw NotFound('Booking not found');
    if (!ACTIVE_FOR_AVAILABILITY.includes(booking.status)) throw ValidationError('Service requests apply to an active stay');
    hotelId = booking.hotel;
  } else {
    throw ValidationError('bookingId is required for a service request');
  }

  const sr = await ServiceRequest.create({ guest: req.user._id, hotel: hotelId, booking: bookingId, type, description });
  res.status(201).json({ success: true, data: { serviceRequest: sr } });
}

async function myServiceRequests(req, res) {
  const srs = await ServiceRequest.find({ guest: req.user._id }).sort('-createdAt').limit(50);
  res.json({ success: true, data: { serviceRequests: srs } });
}

module.exports = { createReview, listHotelReviews, myNotifications, markNotificationRead, createServiceRequest, myServiceRequests };
