const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true, index: true },
    guest: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    hotel: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
    roomCategory: { type: mongoose.Schema.Types.ObjectId, ref: 'RoomCategory', required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String, trim: true, maxlength: 120 },
    comment: { type: String, required: true, trim: true, minlength: 10, maxlength: 2000 },
    // Pending staff/admin moderation; published reviews are shown publicly.
    status: { type: String, enum: ['published', 'pending', 'rejected'], default: 'published', index: true },
  },
  { timestamps: true }
);
// One review per booking is enforced by unique index on booking.

const Review = mongoose.models.Review || mongoose.model('Review', reviewSchema);
module.exports = { Review };
