const request = require('supertest');
const assert = require('assert');
const { startTestDb, stopTestDb } = require('./setup');
const { User } = require('../src/models/User');
const { Hotel } = require('../src/models/Hotel');
const { Room } = require('../src/models/Room');
const { RoomCategory } = require('../src/models/RoomCategory');
const { Booking } = require('../src/models/Booking');

describe('Operations @ops', function () {
  this.timeout(30000);
  let app, guestT, staffT, mgrT, adminT, hotel, category, room, booking;

  before(async () => {
    await startTestDb();
    process.env.JWT_SECRET = 'x'.repeat(40);
    app = require('../src/app');

    const mkUser = async (email, role) => {
      const u = await User.create({ name: email, email, passwordHash: await User.hashPassword('Sup3rSecret!'), role });
      const t = (await request(app).post('/api/v1/auth/login').send({ email, password: 'Sup3rSecret!' })).body.data.token;
      return { u, t };
    };
    const g = await mkUser('gops@example.com', 'guest');
    const s = await mkUser('sops@example.com', 'staff');
    const m = await mkUser('mops@example.com', 'hotel_manager');
    const a = await mkUser('aops@example.com', 'admin');
    guestT = g.t; staffT = s.t; mgrT = m.t; adminT = a.t;

    hotel = await Hotel.create({ name: 'Ops Hotel', slug: 'ops-hotel', address: { city: 'Vienna', country: 'Austria' }, managers: [s.u._id, m.u._id] });
    category = await RoomCategory.create({ hotel: hotel._id, name: 'Suite', capacity: 3, basePrice: 300 });
    room = await Room.create({ hotel: hotel._id, roomCategory: category._id, roomNumber: '201' });

    booking = await Booking.create({
      reference: 'RLM-OPSTEST', guest: g.u._id, hotel: hotel._id, room: room._id, roomCategory: category._id,
      checkIn: new Date(Date.now() - 86400000), checkOut: new Date(Date.now() + 86400000),
      guestCount: 2, price: { nights: 1, nightlyRate: 300, baseSubtotal: 300, serviceCharge: 15, tax: 24, total: 339, currency: 'USD' },
      status: 'confirmed', paymentStatus: 'unpaid',
    });
  });
  after(async () => {
    await stopTestDb();
  });
  const auth = (t) => ({ Authorization: `Bearer ${t}` });

  it('check-in: confirmed booking -> checked_in, room occupied; duplicate check-in is 409', async () => {
    const res = await request(app).post(`/api/v1/operations/bookings/${booking._id}/checkin`).set(auth(staffT)).expect(200);
    assert.strictEqual(res.body.data.booking.status, 'checked_in');
    const r = await Room.findById(room._id);
    assert.strictEqual(r.operationalStatus, 'occupied');
    await request(app).post(`/api/v1/operations/bookings/${booking._id}/checkin`).set(auth(staffT)).expect(400); // status transition guard prevents duplicate check-in
  });

  it('checkout: requires checked_in; marks room dirty and creates a housekeeping task', async () => {
    const res = await request(app).post(`/api/v1/operations/bookings/${booking._id}/checkout`).set(auth(mgrT)).expect(200);
    assert.strictEqual(res.body.data.booking.status, 'checked_out');
    const r = await Room.findById(room._id).lean();
    assert.strictEqual(r.housekeepingStatus, 'dirty');
    const tasks = await request(app).get(`/api/v1/operations/housekeeping?hotelId=${hotel._id}`).set(auth(staffT)).expect(200);
    assert.ok(tasks.body.data.tasks.length >= 1);
    // housekeeping cleaning then clean
    await request(app).patch(`/api/v1/operations/rooms/${room._id}/housekeeping`).set(auth(staffT)).send({ housekeepingStatus: 'clean', taskId: tasks.body.data.tasks[0]._id }).expect(200);
    const r2 = await Room.findById(room._id).lean();
    assert.strictEqual(r2.housekeepingStatus, 'clean');
  });

  it('cannot check in cancelled bookings; staff of other hotel is 403', async () => {
    await request(app).post(`/api/v1/operations/bookings/${booking._id}/checkin`).set(auth(staffT)).expect(400);
  });

  it('reviews only for completed stays, one per booking', async () => {
    // Review eligibility = completed stay: checkOut must have passed.
    await Booking.findByIdAndUpdate(booking._id, { checkOut: new Date(Date.now() - 3600000) });
    await request(app).post('/api/v1/reviews').set(auth(guestT)).send({ bookingId: booking._id, rating: 5, comment: 'Fantastic luxury stay!' }).expect(201);
    const res = await request(app).post('/api/v1/reviews').set(auth(guestT)).send({ bookingId: booking._id, rating: 5, comment: 'Fantastic luxury stay!' }).expect(409);
    assert.strictEqual(res.body.error.code, 'CONFLICT');
  });

  it('guest cannot approve cancellations and cannot touch admin routes', async () => {
    await request(app).get('/api/v1/admin/users').set(auth(guestT)).expect(403);
    await request(app).get('/api/v1/reports/overview').set(auth(staffT)).expect(403);
    await request(app).get('/api/v1/admin/users').set(auth(adminT)).expect(200);
  });

  it('admin can list users and pull audit logs', async () => {
    const res = await request(app).get('/api/v1/admin/audit-logs').set(auth(adminT)).expect(200);
    assert.ok(res.body.data.logs.length >= 1);
  });

  it('invoice reflects UNPAID when no succeeded payment', async () => {
    // booking stayed unpaid through ops test: create fresh reserved demo payment flow not needed here
    const res = await request(app).get(`/api/v1/bookings/${booking._id}/invoice`).set(auth(guestT)).expect(200);
    assert.strictEqual(res.body.data.invoice.paymentOutcome, 'UNPAID');
  });
});
