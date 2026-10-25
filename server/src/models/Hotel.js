const mongoose = require('mongoose');

const hotelSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 150 },
    slug: { type: String, required: true, unique: true, lowercase: true, index: true },
    description: { type: String, trim: true, maxlength: 3000, default: '' },
    address: {
      line1: { type: String, trim: true, maxlength: 200 },
      city: { type: String, required: true, trim: true, index: true, maxlength: 80 },
      state: { type: String, trim: true, maxlength: 80 },
      country: { type: String, required: true, trim: true, maxlength: 80 },
    },
    contact: {
      email: { type: String, trim: true, lowercase: true },
      phone: { type: String, trim: true, maxlength: 30 },
    },
    amenities: [{ type: String, trim: true }],
    images: [{ type: String }],
    active: { type: Boolean, default: true, index: true },
    managers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }],
    currency: { type: String, default: 'INR' },
  },
  { timestamps: true }
);

const Hotel = mongoose.models.Hotel || mongoose.model('Hotel', hotelSchema);
module.exports = { Hotel };
