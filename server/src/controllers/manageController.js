const { Hotel } = require('../models/Hotel');
const { Room } = require('../models/Room');
const { RoomCategory } = require('../models/RoomCategory');
const { NotFound, Forbidden, ValidationError, Conflict } = require('../middleware/errors');
const { slugify } = require('./hotelsController');
const { recordAudit } = require('../models/AuditLog');

// Resolves the hotel and verifies the actor is authorized: admin always passes;
// hotel_manager must be assigned; staff are read-only on hotels they serve via
// explicit assignment too (passport v1: staff access comes through hotel rooms).
async function authorizeHotelAccess(req, hotelId, { write = false } = {}) {
  const hotel = await Hotel.findById(hotelId);
  if (!hotel) throw NotFound('Hotel not found');
  if (req.userRole === 'admin') return hotel;
  if (req.userRole !== 'hotel_manager' && req.userRole !== 'staff') throw Forbidden('Hotel management requires a managerial role');
  if (req.userRole === 'staff' && write) throw Forbidden('Staff cannot modify hotel data');
  const managerAssigned = hotel.managers.some((m) => String(m) === String(req.user._id));
  if (!managerAssigned) throw Forbidden('You are not assigned to this hotel');
  return hotel;
}

async function myHotels(req, res) {
  const filter = req.userRole === 'admin' ? {} : { managers: req.user._id };
  const hotels = await Hotel.find(filter).lean();
  res.json({ success: true, data: { hotels } });
}

async function createHotel(req, res) {
  if (req.userRole !== 'admin') throw Forbidden('Only administrators create hotels');
  const { name, description, address, contact, amenities, images, managerIds, currency } = req.body || {};
  if (!name || !address || !address.city || !address.country) throw ValidationError('name, address.city and address.country are required');
  const hotel = await Hotel.create({
    name,
    slug: slugify(name),
    description,
    address,
    contact,
    amenities: Array.isArray(amenities) ? amenities : [],
    images: Array.isArray(images) ? images : [],
    managers: Array.isArray(managerIds) ? managerIds : [],
    currency,
  });
  await recordAudit({ actorId: req.user._id, actorRole: req.userRole, action: 'hotel.create', targetType: 'Hotel', targetId: hotel._id });
  res.status(201).json({ success: true, data: { hotel } });
}

async function updateHotel(req, res) {
  const hotel = await authorizeHotelAccess(req, req.params.hotelId, { write: true });
  const allowed = ['description', 'contact', 'amenities', 'images', 'currency'];
  allowed.forEach((k) => {
    if (req.body?.[k] !== undefined) hotel[k] = req.body[k];
  });
  await hotel.save();
  await recordAudit({ actorId: req.user._id, actorRole: req.userRole, action: 'hotel.update', targetType: 'Hotel', targetId: hotel._id, hotel: hotel._id });
  res.json({ success: true, data: { hotel } });
}

// ---- Categories ----
async function createCategory(req, res) {
  const hotel = await authorizeHotelAccess(req, req.body.hotelId, { write: true });
  const { name, description, capacity, bedConfiguration, amenities, basePrice, images } = req.body || {};
  if (!name || !capacity || basePrice === undefined) throw ValidationError('name, capacity and basePrice are required');
  if (Number(basePrice) <= 0) throw ValidationError('basePrice must be positive');
  const dup = await RoomCategory.findOne({ hotel: hotel._id, name });
  if (dup) throw Conflict('Category name already exists in this hotel');
  const category = await RoomCategory.create({
    hotel: hotel._id,
    name,
    description,
    capacity: Number(capacity),
    bedConfiguration,
    amenities: Array.isArray(amenities) ? amenities : [],
    basePrice: Number(basePrice),
    images: Array.isArray(images) ? images : [],
  });
  await recordAudit({ actorId: req.user._id, actorRole: req.userRole, action: 'category.create', targetType: 'RoomCategory', targetId: category._id, hotel: hotel._id, details: { name } });
  res.status(201).json({ success: true, data: { category } });
}

async function updateCategory(req, res) {
  const category = await RoomCategory.findById(req.params.categoryId);
  if (!category) throw NotFound('Category not found');
  await authorizeHotelAccess(req, category.hotel, { write: true });
  if (req.body?.name && req.body.name !== category.name) {
    const dup = await RoomCategory.findOne({ hotel: category.hotel, name: req.body.name });
    if (dup) throw Conflict('Category name already exists in this hotel');
  }
  ['name', 'description', 'capacity', 'bedConfiguration', 'amenities', 'basePrice', 'images', 'active'].forEach((k) => {
    if (req.body?.[k] !== undefined) category[k] = req.body[k];
  });
  await category.save();
  res.json({ success: true, data: { category } });
}

// ---- Rooms ----
async function listHotelRooms(req, res) {
  const hotel = await authorizeHotelAccess(req, req.params.hotelId);
  const rooms = await Room.find({ hotel: hotel._id }).sort('roomNumber').populate('roomCategory', 'name basePrice').lean();
  res.json({ success: true, data: { rooms } });
}

async function createRoom(req, res) {
  const hotel = await authorizeHotelAccess(req, req.body.hotelId, { write: true });
  const { roomNumber, roomCategoryId, floor } = req.body || {};
  if (!roomNumber || !roomCategoryId) throw ValidationError('roomNumber and roomCategoryId are required');
  const category = await RoomCategory.findOne({ _id: roomCategoryId, hotel: hotel._id });
  if (!category) throw ValidationError('roomCategoryId does not belong to this hotel');
  const dup = await Room.findOne({ hotel: hotel._id, roomNumber });
  if (dup) throw Conflict(`Room ${roomNumber} already exists in this hotel`);
  const room = await Room.create({
    hotel: hotel._id,
    roomCategory: category._id,
    roomNumber,
    floor: Number(floor) || 1,
  });
  await recordAudit({ actorId: req.user._id, actorRole: req.userRole, action: 'room.create', targetType: 'Room', targetId: room._id, hotel: hotel._id, details: { roomNumber } });
  res.status(201).json({ success: true, data: { room } });
}

async function updateRoom(req, res) {
  const room = await Room.findById(req.params.roomId);
  if (!room) throw NotFound('Room not found');
  await authorizeHotelAccess(req, room.hotel, { write: true });
  ['roomNumber', 'floor', 'operationalStatus', 'housekeepingStatus', 'active', 'notes', 'roomCategory'].forEach((k) => {
    if (req.body?.[k] !== undefined) room[k] = req.body[k];
  });
  // Guard destructive changes against live reservations.
  if (room.active === false) {
    const { Booking } = require('../models/Booking');
    const { ACTIVE_FOR_AVAILABILITY } = require('../services/availability');
    const futureOrCurrent = await Booking.findOne({ room: room._id, status: { $in: ACTIVE_FOR_AVAILABILITY }, checkOut: { $gt: new Date() } });
    if (futureOrCurrent) {
      throw Conflict('Room has active or future reservations; resolve them before deactivating (policy)');
    }
  }
  await room.save();
  res.json({ success: true, data: { room } });
}

module.exports = { myHotels, createHotel, updateHotel, createCategory, updateCategory, listHotelRooms, createRoom, updateRoom, authorizeHotelAccess };
