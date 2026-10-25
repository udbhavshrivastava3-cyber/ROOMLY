const mongoose = require('mongoose');

const HK_STATUSES = ['pending', 'in_progress', 'completed', 'inspected'];

const housekeepingTaskSchema = new mongoose.Schema(
  {
    hotel: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
    room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true, index: true },
    task: { type: String, required: true, trim: true, maxlength: 200 },
    status: { type: String, enum: HK_STATUSES, default: 'pending', index: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    completedAt: Date,
  },
  { timestamps: true }
);

const HousekeepingTask = mongoose.models.HousekeepingTask || mongoose.model('HousekeepingTask', housekeepingTaskSchema);
module.exports = { HousekeepingTask, HK_STATUSES };
