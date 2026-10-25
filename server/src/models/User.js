const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const ROLES = ['guest', 'staff', 'hotel_manager', 'admin'];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true },
    phone: { type: String, trim: true, maxlength: 20 },
    role: { type: String, enum: ROLES, default: 'guest', index: true },
    emailVerified: { type: Boolean, default: false },
    accountStatus: { type: String, enum: ['active', 'suspended'], default: 'active' },
    managedHotels: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Hotel' }],
  },
  { timestamps: true }
);

// Never expose the password hash.
if (!userSchema.options.toJSON) userSchema.options.toJSON = {};
userSchema.options.toJSON.transform = function (doc, ret) {
  ret.id = ret._id;
  delete ret._id;
  delete ret.__v;
  delete ret.passwordHash;
  delete ret.managedHotels;
  return ret;
};

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.passwordHash);
};

userSchema.statics.hashPassword = function hashPassword(plain) {
  return bcrypt.hash(plain, 12);
};

const User = mongoose.models.User || mongoose.model('User', userSchema);
module.exports = { User, ROLES };
