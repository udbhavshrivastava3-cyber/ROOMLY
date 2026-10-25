const mongoose = require('mongoose');

const ROOM_STATUSES = ['available', 'occupied', 'maintenance', 'out_of_service'];
const HOUSEKEEPING_STATUSES = ['clean', 'dirty', 'cleaning_in_progress', 'inspected', 'maintenance'];

const roomSchema = new mongoose.Schema(
  {
    hotel: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
    roomCategory: { type: mongoose.Schema.Types.ObjectId, ref: 'RoomCategory', required: true, index: true },
    roomNumber: { type: String, required: true, trim: true, maxlength: 12 },
    floor: { type: Number, min: 0, max: 200, default: 1 },
    operationalStatus: { type: String, enum: ROOM_STATUSES, default: 'available', index: true },
    housekeepingStatus: { type: String, enum: HOUSEKEEPING_STATUSES, default: 'clean', index: true },
    active: { type: Boolean, default: true, index: true },
    notes: { type: String, trim: true, maxlength: 500, default: '' },
  },
  { timestamps: true }
);

roomSchema.index({ hotel: 1, roomNumber: 1 }, { unique: true });

const Room = mongoose.models.Room || mongoose.model('Room', roomSchema);
module.exports = { Room, ROOM_STATUSES, HOUSEKEEPING_STATUSES };
