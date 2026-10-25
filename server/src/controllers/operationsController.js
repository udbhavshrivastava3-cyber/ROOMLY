const { Booking } = require('../models/Booking');
const { Room } = require('../models/Room');
const { ServiceRequest, SERVICE_STATUSES } = require('../models/ServiceRequest');
const { HousekeepingTask, HK_STATUSES } = require('../models/HousekeepingTask');
const { NotFound, Forbidden, ValidationError, Conflict } = require('../middleware/errors');
const { recordAudit } = require('../models/AuditLog');
const { ACTIVE_FOR_AVAILABILITY } = require('../services/availability');

// Staff can operate on bookings belonging to hotels where they are assigned
// (staff of a hotel) or admins. Hotel assignment is stored on the Hotel doc.
async function staffCanAccessHotel(req, hotelId) {
  if (req.userRole === 'admin') return true;
  const { Hotel } = require('../models/Hotel');
  const hotel = await Hotel.findById(hotelId).select('managers');
  if (!hotel) return false;
  if (req.userRole === 'hotel_manager') return hotel.managers.some((m) => String(m) === String(req.user._id));
  if (req.userRole === 'staff') return hotel.managers.some((m) => String(m) === String(req.user._id)); // staff work under same hotel assignment
  return false;
}

async function todaysBoard(req, res) {
  const { hotelId } = req.query;
  if (!hotelId) throw ValidationError('hotelId required');
  if (!(await staffCanAccessHotel(req, hotelId))) throw Forbidden('Not authorized for this hotel');

  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + 24 * 3600 * 1000);
  const statuses = [...ACTIVE_FOR_AVAILABILITY, 'checked_out'];

  const [arrivals, departures, rooms, serviceRequests] = await Promise.all([
    Booking.find({ hotel: hotelId, status: { $in: ['confirmed'] }, checkIn: { $gte: start, $lt: end } })
      .sort('checkIn').populate('guest', 'name email').populate('room', 'roomNumber').limit(50),
    Booking.find({ hotel: hotelId, status: { $in: ['checked_in'] }, checkOut: { $gte: start, $lt: end } })
      .sort('checkOut').populate('guest', 'name email').populate('room', 'roomNumber').limit(50),
    Room.find({ hotel: hotelId }).sort('roomNumber').populate('roomCategory', 'name').lean(),
    ServiceRequest.find({ hotel: hotelId, status: { $in: ['submitted', 'in_progress'] } })
      .sort('-createdAt').populate('guest', 'name').limit(50),
  ]);

  res.json({
    success: true,
    data: {
      arrivals, departures, rooms, serviceRequests,
      occupancy: {
        occupiedRooms: rooms.filter((r) => r.operationalStatus === 'occupied').length,
        totalRooms: rooms.length,
        housekeepingNeeded: rooms.filter((r) => ['dirty', 'cleaning_in_progress'].includes(r.housekeepingStatus)).length,
        maintenanceRooms: rooms.filter((r) => r.operationalStatus === 'maintenance').length,
      },
    },
  });
}

async function checkIn(req, res) {
  const booking = await Booking.findById(req.params.bookingId);
  if (!booking) throw NotFound('Booking not found');
  if (!(await staffCanAccessHotel(req, booking.hotel))) throw Forbidden('Not authorized for this booking');
  if (booking.status !== 'confirmed') throw ValidationError(`Only confirmed bookings can be checked in (current: ${booking.status})`);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (booking.checkIn > today && false) {} // early check-in allowed by policy; enforced demo behavior

  const room = await Room.findById(booking.room);
  if (!room || room.operationalStatus !== 'available' || room.active === false) {
    throw Conflict(`Room ${room ? room.roomNumber : ''} is not available for check-in`);
  }

  // Guarded transition; prevents duplicate check-in under concurrency.
  const updated = await Booking.findOneAndUpdate(
    { _id: booking._id, status: 'confirmed' },
    { $set: { status: 'checked_in', checkInAt: new Date(), checkInBy: req.user._id } },
    { new: true }
  );
  if (!updated) throw Conflict('Booking was already checked in concurrently');

  await Room.findByIdAndUpdate(booking.room, { operationalStatus: 'occupied' });
  await recordAudit({
    actorId: req.user._id, actorRole: req.userRole, action: 'booking.checkin',
    targetType: 'Booking', targetId: booking._id, hotel: booking.hotel, details: { reference: booking.reference },
  });
  res.json({ success: true, data: { booking: updated } });
}

async function checkOut(req, res) {
  const booking = await Booking.findById(req.params.bookingId);
  if (!booking) throw NotFound('Booking not found');
  if (!(await staffCanAccessHotel(req, booking.hotel))) throw Forbidden('Not authorized for this booking');
  if (booking.status !== 'checked_in') throw ValidationError(`Only checked-in bookings can be checked out (current: ${booking.status})`);

  const updated = await Booking.findOneAndUpdate(
    { _id: booking._id, status: 'checked_in' },
    { $set: { status: 'checked_out', checkOutAt: new Date(), checkOutBy: req.user._id } },
    { new: true }
  );
  if (!updated) throw Conflict('Booking was already checked out concurrently');

  // Checkout does NOT automatically make the room bookable: housekeeping required.
  const room = await Room.findByIdAndUpdate(booking.room, {
    operationalStatus: 'available', // operational notion (not occupied)
    housekeepingStatus: 'dirty', // must be cleaned before next guest
  }, { new: true });

  await HousekeepingTask.create({
    hotel: booking.hotel,
    room: booking.room,
    task: `Clean room ${room.roomNumber} after check-out`,
    createdBy: req.user._id,
  });

  await recordAudit({
    actorId: req.user._id, actorRole: req.userRole, action: 'booking.checkout',
    targetType: 'Booking', targetId: booking._id, hotel: booking.hotel, details: { reference: booking.reference },
  });
  res.json({ success: true, data: { booking: updated, room } });
}

async function approveCancellation(req, res) {
  const booking = await Booking.findById(req.params.bookingId);
  if (!booking) throw NotFound('Booking not found');
  if (!(await staffCanAccessHotel(req, booking.hotel))) throw Forbidden('Not authorized for this booking');
  if (booking.status !== 'cancellation_requested') throw ValidationError(`Only cancellation_requested bookings can be approved (current: ${booking.status})`);
  const updated = await Booking.findOneAndUpdate(
    { _id: booking._id, status: 'cancellation_requested' },
    { $set: { status: 'cancelled', paymentStatus: booking.paymentStatus === 'paid' ? 'refund_processing' : 'unpaid', 'cancellation.cancelledAt': new Date(), 'cancellation.cancelledBy': req.user._id } },
    { new: true }
  );
  if (!updated) throw Conflict('Cancellation already processed');
  const availability = require('../services/availability');
  await availability.releaseNights(booking._id);
  const { Notification } = require('../models/Notification');
  await Notification.create({
    user: booking.guest, type: 'booking_cancelled', title: 'Cancellation approved',
    body: `Booking ${booking.reference} was cancelled by hotel staff.`,
    data: { bookingId: String(booking._id), reference: booking.reference },
  });
  await recordAudit({ actorId: req.user._id, actorRole: req.userRole, action: 'booking.cancel_approve', targetType: 'Booking', targetId: booking._id, hotel: booking.hotel });
  res.json({ success: true, data: { booking: updated } });
}

async function updateHousekeeping(req, res) {
  const room = await Room.findById(req.params.roomId);
  if (!room) throw NotFound('Room not found');
  if (!(await staffCanAccessHotel(req, room.hotel))) throw Forbidden('Not authorized for this hotel');
  const { housekeepingStatus, taskId } = req.body || {};
  if (housekeepingStatus && !['clean', 'dirty', 'cleaning_in_progress', 'inspected', 'maintenance'].includes(housekeepingStatus)) {
    throw ValidationError('Invalid housekeeping status');
  }
  if (room.operationalStatus === 'occupied' && housekeepingStatus === 'clean') {
    throw Conflict('Cannot mark an occupied room as clean');
  }
  if (housekeepingStatus) room.housekeepingStatus = housekeepingStatus;
  await room.save();

  if (taskId) {
    const task = await HousekeepingTask.findById(taskId);
    if (task && String(task.room) === String(room._id)) {
      const taskStatus = { clean: 'completed', inspected: 'inspected' }[housekeepingStatus] || 'in_progress';
      const upd = await HousekeepingTask.findOneAndUpdate(
        { _id: task._id, status: { $ne: taskStatus } },
        { status: taskStatus, completedAt: taskStatus === 'completed' ? new Date() : undefined, assignedTo: req.user._id },
        { new: true }
      );
      res.hkTask = upd;
    }
  }
  await recordAudit({ actorId: req.user._id, actorRole: req.userRole, action: 'room.housekeeping', targetType: 'Room', targetId: room._id, hotel: room.hotel, details: { housekeepingStatus } });
  res.json({ success: true, data: { room, task: res.hkTask } });
}

async function listHousekeepingTasks(req, res) {
  const { hotelId } = req.query;
  if (!hotelId) throw ValidationError('hotelId required');
  if (!(await staffCanAccessHotel(req, hotelId))) throw Forbidden('Not authorized for this hotel');
  const tasks = await HousekeepingTask.find({ hotel: hotelId }).sort({ createdAt: -1 }).limit(100).populate('room', 'roomNumber').lean();
  res.json({ success: true, data: { tasks } });
}

async function updateServiceRequest(req, res) {
  const sr = await ServiceRequest.findById(req.params.serviceRequestId);
  if (!sr) throw NotFound('Service request not found');
  if (!(await staffCanAccessHotel(req, sr.hotel))) throw Forbidden('Not authorized for this hotel');
  const { status, resolutionNote } = req.body || {};
  if (status && !SERVICE_STATUSES.includes(status)) throw ValidationError('Invalid status');
  if (status) {
    sr.status = status;
    if (status === 'resolved' || status === 'rejected') {
      sr.resolvedBy = req.user._id;
      sr.resolvedAt = new Date();
      sr.resolutionNote = resolutionNote || sr.resolutionNote;
      const { Notification } = require('../models/Notification');
      await Notification.create({
        user: sr.guest, type: 'service_request_update', title: `Service request ${status}`,
        body: `Your service request was ${status}.`, data: { serviceRequestId: String(sr._id) },
      });
    }
  }
  await sr.save();
  res.json({ success: true, data: { serviceRequest: sr } });
}

module.exports = { todaysBoard, checkIn, checkOut, approveCancellation, updateHousekeeping, listHousekeepingTasks, updateServiceRequest, staffCanAccessHotel };
