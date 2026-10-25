const mongoose = require('mongoose');

const roomCategorySchema = new mongoose.Schema(
  {
    hotel: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, trim: true, maxlength: 2000, default: '' },
    capacity: { type: Number, required: true, min: 1, max: 10 },
    bedConfiguration: { type: String, trim: true, maxlength: 100, default: 'Queen bed' },
    amenities: [{ type: String, trim: true }],
    basePrice: { type: Number, required: true, min: 0, max: 100000 },
    images: [{ type: String }],
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

roomCategorySchema.index({ hotel: 1, name: 1 }, { unique: true });

const RoomCategory = mongoose.models.RoomCategory || mongoose.model('RoomCategory', roomCategorySchema);
module.exports = { RoomCategory };
