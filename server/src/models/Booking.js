const mongoose = require('mongoose');

// Booking state model (docs/DATABASE_SCHEMA.md):
// pending_payment -> confirmed -> checked_in -> checked_out
// pending_payment -> cancelled | expired
// confirmed -> cancellation_requested -> cancelled
// confirmed -> checked_in -> cancellation not allowed
const BOOKING_STATUSES = [
  'pending_payment',
  'confirmed',
  'cancellation_requested',
  'cancellation_approved',
  'cancelled',
  'checked_in',
  'checked_out',
  'expired',
];

const priceBreakdownSchema = new mongoose.Schema(
  {
    nights: { type: Number, required: true, min: 1 },
    nightlyRate: { type: Number, required: true, min: 0 }, // snapshot per night (base or seasonal avg)
    baseSubtotal: { type: Number, required: true, min: 0 },
    serviceCharge: { type: Number, required: true, min: 0 },
    tax: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR' },
  },
  { _id: false }
);

const bookingSchema = new mongoose.Schema(
  {
    reference: { type: String, required: true, unique: true },
    guest: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    hotel: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
    room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true, index: true },
    roomCategory: { type: mongoose.Schema.Types.ObjectId, ref: 'RoomCategory', required: true },
    checkIn: { type: Date, required: true, index: true },
    checkOut: { type: Date, required: true, index: true },
    guestCount: { type: Number, required: true, min: 1, max: 20 },
    price: { type: priceBreakdownSchema, required: true },
    status: { type: String, enum: BOOKING_STATUSES, default: 'pending_payment', index: true },
    paymentStatus: {
      type: String,
      enum: ['unpaid', 'paid', 'refunded', 'refund_requested', 'refund_processing'],
      default: 'unpaid',
      index: true,
    },
    source: { type: String, enum: ['web', 'staff'], default: 'web' },
    cancellation: {
      requestedAt: Date,
      reason: { type: String, maxlength: 500 },
      cancelledAt: Date,
      cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
    checkInAt: Date,
    checkInBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    checkOutAt: Date,
    checkOutBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    expiresAt: { type: Date, index: true }, // pending_payment TTL via cleanup job
  },
  { timestamps: true }
);

// Overlap query is hotel+room scoped on datetime range; the compound indexes below
// back the availability engine.
bookingSchema.index({ room: 1, checkIn: 1, checkOut: 1 });

const Booking = mongoose.models.Booking || mongoose.model('Booking', bookingSchema);
module.exports = { Booking, BOOKING_STATUSES };
