const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    actorRole: { type: String },
    action: { type: String, required: true, index: true },
    targetType: { type: String, maxlength: 50 },
    targetId: { type: String },
    hotel: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', index: true },
    details: { type: mongoose.Schema.Types.Mixed },
    ip: { type: String, maxlength: 64 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);

// Fire-and-forget; audit failures must not break the primary request.
async function recordAudit(data) {
  try {
    if (!data.actorId) return;
    await AuditLog.create({
      actor: data.actorId,
      actorRole: data.actorRole,
      action: data.action,
      targetType: data.targetType,
      targetId: data.targetId ? String(data.targetId) : undefined,
      hotel: data.hotel,
      details: data.details,
      ip: data.ip,
    });
  } catch (err) {
    console.error('[audit] failed to record:', err.message);
  }
}

module.exports = { AuditLog, recordAudit };
