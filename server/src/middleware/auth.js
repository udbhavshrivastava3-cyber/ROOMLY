const env = require('../config/env');
const { verifyToken } = require('../utils/tokens');
const { User } = require('../models/User');

function extractToken(req) {
  if (req.cookies && req.cookies[env.cookieName]) return req.cookies[env.cookieName];
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  return null;
}

// Attaches req.user when a valid token is presented; never rejects on its own.
async function optionalAuth(req, _res, next) {
  try {
    const token = extractToken(req);
    if (!token) return next();
    const payload = verifyToken(token);
    const user = await User.findById(payload.sub).select('-passwordHash');
    if (user && user.accountStatus === 'active') {
      req.user = user;
      req.userRole = user.role;
    }
    next();
  } catch {
    next(); // invalid/expired token behaves like signed-out for optional routes
  }
}

async function requireAuth(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    }
    const payload = verifyToken(token);
    const user = await User.findById(payload.sub).select('-passwordHash');
    if (!user) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'User no longer exists' } });
    }
    if (user.accountStatus !== 'active') {
      return res.status(403).json({ success: false, error: { code: 'ACCOUNT_SUSPENDED', message: 'Account suspended' } });
    }
    req.user = user;
    req.userRole = user.role;
    next();
  } catch (err) {
    const expired = err.name === 'TokenExpiredError';
    return res.status(401).json({ success: false, error: { code: expired ? 'SESSION_EXPIRED' : 'UNAUTHENTICATED', message: 'Invalid or expired session' } });
  }
}

const ROLE_RANK = { guest: 0, staff: 1, hotel_manager: 2, admin: 3 };

// requireRole('staff') admits staff, hotel_manager and admin (rank-based).
// requireRole(['staff'], { exact: true }) admits staff only.
function requireRole(role, opts = {}) {
  const roles = Array.isArray(role) ? role : [role];
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    }
    const admitted = opts.exact ? roles.includes(req.userRole) : roles.some((r) => ROLE_RANK[req.userRole] >= ROLE_RANK[r]);
    if (!admitted) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } });
    }
    next();
  };
}

module.exports = { optionalAuth, requireAuth, requireRole, extractToken };
