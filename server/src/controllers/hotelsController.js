const { Hotel } = require('../models/Hotel');
const { Room } = require('../models/Room');
const { RoomCategory } = require('../models/RoomCategory');
const { NotFound, ValidationError, Forbidden } = require('../middleware/errors');

function slugify(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

async function listHotels(req, res) {
  const { city, amenity, page = 1, limit = 12, sort = 'name', includeInactive } = req.query;
  // Public callers only ever see active hotels; admins may include inactive
  // ones (needed by the admin Hotels tab so deactivated hotels can be reactivated).
  const wantsInactive = includeInactive === '1' || includeInactive === 'true';
  if (wantsInactive && req.userRole !== 'admin') throw Forbidden('Administrators only');
  const filter = wantsInactive ? {} : { active: true };
  if (city) filter['address.city'] = new RegExp(String(city).trim(), 'i');
  if (amenity) filter.amenities = String(amenity);

  const lim = Math.min(Math.max(parseInt(limit, 10) || 12, 1), 50);
  const skip = (Math.max(parseInt(page, 10) || 1, 1) - 1) * lim;
  const sortMap = { name: { name: 1 }, '-name': { name: -1 }, newest: { createdAt: -1 } };
  const sortSpec = sortMap[sort] || sortMap.name;

  const [total, hotels] = await Promise.all([
    Hotel.countDocuments(filter),
    Hotel.find(filter).sort(sortSpec).skip(skip).limit(lim).lean(),
  ]);
  res.json({ success: true, data: { hotels, pagination: { total, page: Number(page) || 1, limit: lim, pages: Math.ceil(total / lim) } } });
}

async function getHotel(req, res) {
  const hotel = await Hotel.findById(req.params.hotelId).lean();
  if (!hotel) throw NotFound('Hotel not found');
  const publicCategories = await RoomCategory.find({ hotel: hotel._id, active: true }).lean();
  res.json({ success: true, data: { hotel, roomCategories: publicCategories } });
}

async function listRooms(req, res) {
  const { hotel, category, minPrice, maxPrice, guests, capacity, page = 1, limit = 12, sort = 'price_asc', amenity } = req.query;

  const categoryFilter = { active: true };
  if (hotel) categoryFilter.hotel = hotel;
  if (guests || capacity) {
    categoryFilter.capacity = { $gte: Math.max(parseInt(guests || capacity, 10) || 1, 1) };
  }
  if (minPrice || maxPrice) {
    categoryFilter.basePrice = {};
    if (minPrice) categoryFilter.basePrice.$gte = parseFloat(minPrice) || 0;
    if (maxPrice) categoryFilter.basePrice.$lte = parseFloat(maxPrice) || 1000000;
  }
  if (amenity) categoryFilter.amenities = String(amenity);

  const lim = Math.min(Math.max(parseInt(limit, 10) || 12, 1), 50);
  const skip = (Math.max(parseInt(page, 10) || 1, 1) - 1) * lim;
  const sortMap = {
    price_asc: { basePrice: 1 },
    price_desc: { basePrice: -1 },
    capacity_asc: { capacity: 1 },
    capacity_desc: { capacity: -1 },
  };
  const sortSpec = sortMap[sort] || sortMap.price_asc;

  const matchingCategories = await RoomCategory.find(categoryFilter)
    .sort(sortSpec)
    .skip(skip)
    .limit(lim)
    .populate('hotel', 'name slug address images amenities')
    .lean();

  const total = await RoomCategory.countDocuments(categoryFilter);

  // Include each category's physical room inventory so cards can show bookable rooms.
  const categoryIds = matchingCategories.map((c) => c._id);
  const rooms = await Room.find({ roomCategory: { $in: categoryIds }, active: true, operationalStatus: 'available' }).lean();
  const byCategory = {};
  rooms.forEach((r) => {
    const k = String(r.roomCategory);
    (byCategory[k] = byCategory[k] || []).push(String(r._id));
  });

  res.json({
    success: true,
    data: {
      rooms: matchingCategories.map((c) => ({ ...c, bookableRoomIds: byCategory[String(c._id)] || [] })),
      pagination: { total, page: Number(page) || 1, limit: lim, pages: Math.ceil(total / lim) },
    },
  });
}

async function getRoom(req, res) {
  const room = await Room.findById(req.params.roomId).populate('roomCategory').populate('hotel', '_id name slug address amenities images').lean();
  if (!room || !room.active) throw NotFound('Room not found');
  const sample = await Room.countDocuments({ roomCategory: room.roomCategory._id, active: true, operationalStatus: 'available' });
  res.json({ success: true, data: { room: { ...room, bookableRoomIds: [room._id] }, category: room.roomCategory, hotel: room.hotel, inventoryAvailable: sample > 0 } });
}

module.exports = { listHotels, getHotel, listRooms, getRoom, slugify };
