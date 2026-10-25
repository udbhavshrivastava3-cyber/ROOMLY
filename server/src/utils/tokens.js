const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const env = require('../config/env');

// Read the secret lazily so test environments that set process.env after require still work.
function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT secret is not configured');
  return secret;
}

function signToken(user) {
  return jwt.sign({ sub: String(user._id), role: user.role }, jwtSecret(), {
    expiresIn: env.jwtExpiresIn,
  });
}

function verifyToken(token) {
  return jwt.verify(token, jwtSecret());
}

function newBookingReference() {
  // Readable, random booking reference e.g. RLM-9F3K2A
  const rand = crypto.randomBytes(4).toString('hex').toUpperCase().slice(0, 6);
  return `RLM-${Date.now().toString(36).toUpperCase().slice(-4)}${rand}`;
}

module.exports = { signToken, verifyToken, newBookingReference };
