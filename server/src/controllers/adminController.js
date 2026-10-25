const { User } = require('../models/User');
const { Hotel } = require('../models/Hotel');
const { AuditLog } = require('../models/AuditLog');
const { NotFound, ValidationError, Forbidden, Conflict } = require('../middleware/errors');
const { recordAudit } = require('../models/AuditLog');
const { ROLES } = require('../models/User');

async function listUsers(req, res) {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
  const filter = {};
  if (req.query.role) filter.role = req.query.role;
  if (req.query.q) filter.email = new RegExp(String(req.query.q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const [total, users] = await Promise.all([
    User.countDocuments(filter),
    User.find(filter).sort('-createdAt').skip((page - 1) * limit).limit(limit).lean(),
  ]);
  res.json({ success: true, data: { users, pagination: { total, page, limit, pages: Math.ceil(total / limit) } } });
}

const ADMIN_ASSIGNABLE = ROLES;

async function updateUserRole(req, res) {
  const { role } = req.body || {};
  if (!ADMIN_ASSIGNABLE.includes(role)) throw ValidationError(`role must be one of: ${ROLES.join(', ')}`);
  const user = await User.findById(req.params.userId);
  if (!user) throw NotFound('User not found');
  if (String(user._id) === String(req.user._id) && role !== 'admin') {
    throw Forbidden('Administrators cannot demote themselves');
  }
  user.role = role;
  await user.save();
  await recordAudit({ actorId: req.user._id, actorRole: req.userRole, action: 'user.role_update', targetType: 'User', targetId: user._id, details: { role } });
  res.json({ success: true, data: { user: user.toJSON() } });
}

async function assignHotelManager(req, res) {
  const { hotelId } = req.params;
  const { managerId } = req.body || {};
  const hotel = await Hotel.findById(hotelId);
  if (!hotel) throw NotFound('Hotel not found');
  const manager = await User.findById(managerId);
  if (!manager || !['hotel_manager', 'staff'].includes(manager.role)) {
    throw ValidationError('managerId must be a user with hotel_manager or staff role');
  }
  const already = hotel.managers.some((m) => String(m) === String(managerId));
  if (already) throw Conflict('Already assigned to this hotel');
  hotel.managers.addToSet(managerId);
  await hotel.save();
  await User.findByIdAndUpdate(managerId, { $addToSet: { managedHotels: hotel._id } });
  await recordAudit({ actorId: req.user._id, actorRole: req.userRole, action: 'hotel.assign_manager', targetType: 'Hotel', targetId: hotel._id, details: { managerId } });
  res.json({ success: true, data: { hotel } });
}

async function removeHotelManager(req, res) {
  const hotel = await Hotel.findById(req.params.hotelId);
  if (!hotel) throw NotFound('Hotel not found');
  hotel.managers.pull(req.params.managerId);
  await hotel.save();
  await User.findByIdAndUpdate(req.params.managerId, { $pull: { managedHotels: hotel._id } });
  await recordAudit({ actorId: req.user._id, actorRole: req.userRole, action: 'hotel.remove_manager', targetType: 'Hotel', targetId: hotel._id, details: { managerId: req.params.managerId } });
  res.json({ success: true, data: { hotel } });
}

async function setHotelActive(req, res) {
  const hotel = await Hotel.findById(req.params.hotelId);
  if (!hotel) throw NotFound('Hotel not found');
  hotel.active = !!req.body?.active;
  await hotel.save();
  await recordAudit({ actorId: req.user._id, actorRole: req.userRole, action: 'hotel.set_active', targetType: 'Hotel', targetId: hotel._id, details: { active: hotel.active } });
  res.json({ success: true, data: { hotel } });
}

async function auditLogs(req, res) {
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
  const action = req.query.action !== undefined ? String(req.query.action) : undefined;
  const filter = {};
  if (action) filter.action = new RegExp(String(action), 'i');
  const logs = await AuditLog.find(filter).sort('-createdAt').limit(limit).populate('actor', 'name role').lean();
  res.json({ success: true, data: { logs } });
}

module.exports = { listUsers, updateUserRole, assignHotelManager, removeHotelManager, setHotelActive, auditLogs };
