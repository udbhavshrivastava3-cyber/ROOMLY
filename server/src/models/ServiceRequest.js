const mongoose = require('mongoose');

const SERVICE_TYPES = ['housekeeping', 'extra_amenities', 'maintenance', 'food_beverage', 'other'];
const SERVICE_STATUSES = ['submitted', 'in_progress', 'resolved', 'rejected'];

const serviceRequestSchema = new mongoose.Schema(
  {
    guest: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    hotel: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', index: true },
    type: { type: String, enum: SERVICE_TYPES, required: true },
    description: { type: String, required: true, trim: true, minlength: 5, maxlength: 1000 },
    status: { type: String, enum: SERVICE_STATUSES, default: 'submitted', index: true },
    resolutionNote: { type: String, trim: true, maxlength: 500 },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    resolvedAt: Date,
  },
  { timestamps: true }
);

const ServiceRequest = mongoose.models.ServiceRequest || mongoose.model('ServiceRequest', serviceRequestSchema);
module.exports = { ServiceRequest, SERVICE_TYPES, SERVICE_STATUSES };
