const router = require('express').Router();
const { requireAuth, requireRole, optionalAuth } = require('../middleware/auth');
const { wrap } = require('../middleware/errors');

const hotels = require('../controllers/hotelsController');
const bookings = require('../controllers/bookingsController');
const payments = require('../controllers/paymentsController');
const invoices = require('../controllers/invoicesController');
const ops = require('../controllers/operationsController');
const guest = require('../controllers/guestFeaturesController');
const manage = require('../controllers/manageController');
const admin = require('../controllers/adminController');
const reports = require('../controllers/reportsController');
const { Review } = require('../models/Review');

// ---- Public hotels & rooms ----
router.get('/hotels', wrap(hotels.listHotels));
router.get('/hotels/:hotelId', wrap(hotels.getHotel));
router.get('/hotels/:hotelId/reviews', wrap(guest.listHotelReviews));
router.get('/rooms', wrap(hotels.listRooms));
router.get('/rooms/:roomId', wrap(hotels.getRoom));

// ---- Availability search (public) ----
router.get('/availability', async (req, res, next) => {
  try {
    const availability = require('../services/availability');
    const { hotelId, checkIn, checkOut, guests } = req.query;
    if (!hotelId || !checkIn || !checkOut) throw (require('../middleware/errors').ValidationError)('hotelId, checkIn, checkOut required');
    const ci = new Date(checkIn); const co = new Date(checkOut);
    if (isNaN(ci) || isNaN(co)) throw (require('../middleware/errors').ValidationError)('Invalid dates');
    if (co <= ci) throw (require('../middleware/errors').ValidationError)('Check-out must be after check-in');
    if (ci < new Date(new Date().setHours(24, 0, 0, 0))) throw (require('../middleware/errors').ValidationError)('Check-in date cannot be in the past');
    let rooms = await availability.availableRooms(hotelId, ci, co);
    if (guests) rooms = rooms.filter((r) => r.roomCategory.capacity >= Number(guests));
    res.json({ success: true, data: { rooms, checkIn: ci.toISOString(), checkOut: co.toISOString() } });
  } catch (err) {
    next(err);
  }
});

// ---- Bookings ----
router.post('/bookings', requireAuth, requireRole('guest'), wrap(bookings.createBooking));
router.get('/bookings/my', requireAuth, wrap(bookings.listMyBookings));
router.get('/bookings/:bookingId', requireAuth, wrap(bookings.getBooking));
router.post('/bookings/:bookingId/cancel', requireAuth, requireRole('guest'), wrap(bookings.requestCancellation));

// ---- Payments (demo) ----
router.post('/bookings/:bookingId/payments/demo', requireAuth, wrap(payments.createDemoCheckout));
router.post('/bookings/:bookingId/payments/demo/confirm', requireAuth, wrap(payments.confirmDemo));
router.get('/payments/my', requireAuth, wrap(payments.myPayments));

// ---- Invoices ----
router.get('/bookings/:bookingId/invoice', requireAuth, wrap(invoices.getInvoice));

// ---- Operations (staff+) ----
router.get('/operations/board', requireAuth, requireRole('staff'), wrap(ops.todaysBoard));
router.post('/operations/bookings/:bookingId/checkin', requireAuth, requireRole('staff'), wrap(ops.checkIn));
router.post('/operations/bookings/:bookingId/checkout', requireAuth, requireRole('staff'), wrap(ops.checkOut));
router.post('/operations/bookings/:bookingId/approve-cancellation', requireAuth, requireRole('staff'), wrap(ops.approveCancellation));
router.patch('/operations/rooms/:roomId/housekeeping', requireAuth, requireRole('staff'), wrap(ops.updateHousekeeping));
router.get('/operations/housekeeping', requireAuth, requireRole('staff'), wrap(ops.listHousekeepingTasks));
router.patch('/operations/service-requests/:serviceRequestId', requireAuth, requireRole('staff'), wrap(ops.updateServiceRequest));

// ---- Guest features ----
router.post('/reviews', requireAuth, wrap(guest.createReview));
router.get('/notifications', requireAuth, wrap(guest.myNotifications));
router.patch('/notifications/:notificationId/read', requireAuth, wrap(guest.markNotificationRead));
router.post('/service-requests', requireAuth, wrap(guest.createServiceRequest));
router.get('/service-requests/my', requireAuth, wrap(guest.myServiceRequests));

// ---- Hotel management ----
router.get('/manage/hotels', requireAuth, requireRole('staff'), wrap(manage.myHotels));
router.post('/manage/hotels', requireAuth, requireRole('admin'), wrap(manage.createHotel));
router.patch('/manage/hotels/:hotelId', requireAuth, requireRole('staff'), wrap(manage.updateHotel));
router.post('/manage/categories', requireAuth, requireRole('staff'), wrap(manage.createCategory));
router.patch('/manage/categories/:categoryId', requireAuth, requireRole('staff'), wrap(manage.updateCategory));
router.get('/manage/hotels/:hotelId/rooms', requireAuth, requireRole('staff'), wrap(manage.listHotelRooms));
router.post('/manage/rooms', requireAuth, requireRole('staff'), wrap(manage.createRoom));
router.patch('/manage/rooms/:roomId', requireAuth, requireRole('staff'), wrap(manage.updateRoom));

// ---- Reports ----
router.get('/reports/hotels/:hotelId', requireAuth, requireRole('staff'), wrap(reports.hotelReport));
router.get('/reports/overview', requireAuth, requireRole('admin'), wrap(reports.adminOverview));

// ---- Admin ----
router.get('/admin/users', requireAuth, requireRole('admin'), wrap(admin.listUsers));
router.patch('/admin/users/:userId/role', requireAuth, requireRole('admin'), wrap(admin.updateUserRole));
router.post('/admin/hotels/:hotelId/managers', requireAuth, requireRole('admin'), wrap(admin.assignHotelManager));
router.delete('/admin/hotels/:hotelId/managers/:managerId', requireAuth, requireRole('admin'), wrap(admin.removeHotelManager));
router.patch('/admin/hotels/:hotelId/active', requireAuth, requireRole('admin'), wrap(admin.setHotelActive));
router.get('/admin/audit-logs', requireAuth, requireRole('admin'), wrap(admin.auditLogs));

module.exports = router;
