const mongoose = require('mongoose');

// Payment provider values:
//  - "demo": Roomly Demo Pay (explicitly labeled simulation, no real money)
//  - "stripe": Stripe Checkout in test mode with server-side verification
// Amount is stored in the smallest currency unit (cents), per provider convention.
const paymentSchema = new mongoose.Schema(
  {
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
    guest: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    provider: { type: String, enum: ['demo', 'stripe'], required: true },
    amount: { type: Number, required: true, min: 1 }, // smallest currency unit
    currency: { type: String, required: true, default: 'USD' },
    status: {
      type: String,
      enum: ['created', 'pending', 'succeeded', 'failed', 'refunded', 'refund_processing'],
      default: 'created',
      index: true,
    },
    providerOrderId: { type: String, index: true },
    providerTransactionId: { type: String },
    idempotencyKey: { type: String, required: true }, // typically the booking reference
    failureReason: { type: String, maxlength: 300 },
    isDemo: { type: Boolean, required: true },
    refundedAt: Date,
    refundAmount: { type: Number, min: 0 },
  },
  { timestamps: true }
);

paymentSchema.index({ idempotencyKey: 1 }, { unique: true });

const Payment = mongoose.models.Payment || mongoose.model('Payment', paymentSchema);
module.exports = { Payment };
