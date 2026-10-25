const env = require('../config/env');
const { User } = require('../models/User');
const { signToken } = require('../utils/tokens');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function setAuthCookie(res, token) {
  res.cookie(env.cookieName, token, {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: env.nodeEnv === 'production' ? 'none' : 'lax',
    maxAge: 7 * 24 * 3600 * 1000,
    path: '/',
  });
  return res;
}

function authPayload(res, user) {
  const token = signToken(user);
  setAuthCookie(res, token);
  res.json({ success: true, data: { user: user.toJSON(), token } });
}

const PASSWORD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{10,64}$/;

async function register(req, res) {
  const { name, email, password, phone } = req.body || {};
  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Name is required (min 2 chars)' } });
  }
  if (!email || !EMAIL_RE.test(String(email))) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'A valid email is required' } });
  }
  if (!password || !PASSWORD_RE.test(password)) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Password must be 10+ chars with upper, lower and digit' },
    });
  }

  const normalized = String(email).toLowerCase().trim();
  const existing = await User.findOne({ email: normalized });
  if (existing) {
    // Do not reveal whether the account exists beyond this duplicate-registration hint.
    return res.status(409).json({ success: false, error: { code: 'DUPLICATE', message: 'An account with this email already exists' } });
  }

  const passwordHash = await User.hashPassword(password);
  // Role is ALWAYS 'guest' on public registration - mass-assignment safe.
  const user = await User.create({ name: name.trim(), email: normalized, passwordHash, phone, role: 'guest' });
  return authPayload(res, user);
}

async function login(req, res) {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Email and password are required' } });
  }
  const user = await User.findOne({ email: String(email).toLowerCase().trim() }).select('+passwordHash');
  const ok = user && (await user.comparePassword(password));
  // Uniform error avoids account enumeration.
  if (!ok) {
    return res.status(401).json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
  }
  if (user.accountStatus !== 'active') {
    return res.status(403).json({ success: false, error: { code: 'ACCOUNT_SUSPENDED', message: 'Account suspended' } });
  }
  return authPayload(res, user);
}

async function logout(req, res) {
  res.clearCookie(env.cookieName, { httpOnly: true, path: '/' });
  res.json({ success: true, data: { loggedOut: true } });
}

async function me(req, res) {
  res.json({ success: true, data: { user: req.user.toJSON() } });
}

async function updateProfile(req, res) {
  const allowed = {};
  if (req.body && typeof req.body.name === 'string' && req.body.name.trim().length >= 2) allowed.name = req.body.name.trim();
  if (typeof req.body?.phone === 'string') {
    if (req.body.phone.length > 20) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Phone too long' } });
    }
    allowed.phone = req.body.phone.trim();
  }
  // Email changes and role/domain-none fields are intentionally not mass-assignable here.
  const updated = await User.findByIdAndUpdate(req.user._id, allowed, { new: true, runValidators: true }).select('-passwordHash');
  res.json({ success: true, data: { user: updated.toJSON() } });
}

module.exports = { register, login, logout, me, updateProfile };
