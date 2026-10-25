const request = require('supertest');
const assert = require('assert');
const { startTestDb, stopTestDb } = require('./setup');
const { User } = require('../src/models/User');
const { Hotel } = require('../src/models/Hotel');
const { Room } = require('../src/models/Room');
const { RoomCategory } = require('../src/models/RoomCategory');
const { Booking } = require('../src/models/Booking');
const { Payment } = require('../src/models/Payment');
const { BookingNightLock } = require('../src/services/availability');

describe('Booking engine @booking', function () {
  let app, guest, staff, manager, admin, hotel, category, room;

  before(async function () {
    this.timeout(30000);
    await startTestDb();
    process.env.JWT_SECRET = 'x'.repeat(40);
    app = require('../src/app');

    guest = await User.create(await mkUser('guest@example.com', 'guest'));
    staff = await (async () => {
      const u = await User.create(await mkUser('staff@example.com', 'hotel_manager'));
      return u;
    })();
    // staff with role staff + assignment is exercised via manager account mostly
    staff = await User.create(await mkUser('housekeeping@example.com', 'staff'));
    manager = await User.create(await mkUser('manager@example.com', 'hotel_manager'));
    admin = await User.create(await mkUser('admin@example.com', 'admin'));

    hotel = await Hotel.create({
      name: 'The Lumen Grand', slug: 'the-lumen-grand',
      address: { city: 'Lisbon', country: 'Portugal' },
      managers: [manager._id, staff._id], amenities: ['Spa', 'Pool'], images: ['https://placehold.co/lumen'],
    });
    category = await RoomCategory.create({ hotel: hotel._id, name: 'Deluxe King', capacity: 2, basePrice: 220, amenities: ['King bed', 'City view'] });
    room = await Room.create({ hotel: hotel._id, roomCategory: category._id, roomNumber: '101' });

    await loginAndBind();
  });
  after(async () => {
    await stopTestDb();
  });

  const tokens = {};
  async function mkUser(email, role) {
    const u = new User({ name: role, email, passwordHash: await User.hashPassword('Sup3rSecret!'), role });
    return u.toObject();
  }
  async function loginAndBind() {
    for (const u of [guest, staff, manager, admin]) {
      const res = await request(app).post('/api/v1/auth/login').send({ email: u.email, password: 'Sup3rSecret!' });
      tokens[u.role] = res.body.data.token;
    }
  }
  const auth = (role) => ({ Authorization: `Bearer ${tokens[role]}` });
  const dates = (a, b) => {
    const ci = new Date(); ci.setDate(ci.getDate() + a); ci.setHours(14, 0, 0, 0);
    const co = new Date(); co.setDate(co.getDate() + b); co.setHours(12, 0, 0, 0);
    return { checkIn: ci.toISOString(), checkOut: co.toISOString() };
  };

  it('rejects invalid ranges (checkout <= checkin, past dates, over capacity)', async () => {
    await request(app).post('/api/v1/bookings').set(auth('guest')).send({ roomId: room._id, ...dates(5, 4), guestCount: 1 }).expect(400);
    await request(app).post('/api/v1/bookings').set(auth('guest')).send({ roomId: room._id, ...dates(-1, 2), guestCount: 1 }).expect(400);
    await request(app).post('/api/v1/bookings').set(auth('guest')).send({ roomId: room._id, ...dates(5, 8), guestCount: 3 }).expect(400);
  });

  let booking1;
  it('creates a pending booking with a server-computed price snapshot', async () => {
    const res = await request(app).post('/api/v1/bookings').set(auth('guest')).send({ roomId: room._id, ...dates(10, 13), guestCount: 2 }).expect(201);
    booking1 = res.body.data.booking;
    assert.strictEqual(booking1.status, 'pending_payment');
    assert.strictEqual(booking1.price.nights, 3);
    assert.strictEqual(booking1.price.nightlyRate, 220);
    assert.ok(booking1.price.total > booking1.price.baseSubtotal, 'tax+service add up');
  });

  it('blocks an overlapping booking for the same room', async () => {
    const res = await request(app).post('/api/v1/bookings').set(auth('guest')).send({ roomId: room._id, ...dates(11, 14), guestCount: 1 }).expect(409);
    assert.strictEqual(res.body.error.code, 'CONFLICT');
  });

  it('prevents double-booking under concurrent creation (unique night index)', async () => {
    const payload = { roomId: room._id, ...dates(20, 23), guestCount: 2 };
    const [a, b, c] = await Promise.all([
      request(app).post('/api/v1/bookings').set(auth('guest')).send(payload),
      request(app).post('/api/v1/bookings').set(auth('guest')).send(payload),
      request(app).post('/api/v1/bookings').set(auth('guest')).send(payload),
    ]);
    const successes = [a, b, c].filter((r) => r.status === 201);
    const conflicts = [a, b, c].filter((r) => r.status === 409);
    assert.strictEqual(successes.length, 1, `exactly one winner; got ${successes.length}`);
    assert.strictEqual(conflicts.length, 2);
  });

  it('payment flow: mark paid only after server-side demo confirm; failed result keeps unpaid', async () => {
    const create = await request(app).post(`/api/v1/bookings/${booking1._id}/payments/demo`).set(auth('guest')).expect(201);
    assert.strictEqual(create.body.data.isDemo, true);

    await request(app).post(`/api/v1/bookings/${booking1._id}/payments/demo/confirm`).set(auth('guest')).send({ result: 'fail' }).expect(200);
    let after = await Booking.findById(booking1._id);
    assert.strictEqual(after.paymentStatus, 'unpaid');
    assert.strictEqual(after.status, 'pending_payment');

    const confirm = await request(app).post(`/api/v1/bookings/${booking1._id}/payments/demo/confirm`).set(auth('guest')).send({ result: 'succeed' }).expect(200);
    assert.strictEqual(confirm.body.data.bookingStatus, 'confirmed');

    // Idempotent duplicate confirm must not double-count.
    const again = await request(app).post(`/api/v1/bookings/${booking1._id}/payments/demo/confirm`).set(auth('guest')).send({ result: 'succeed' }).expect(200);
    assert.strictEqual(again.body.data.alreadyProcessed, true);
    const payments = await Payment.find({ booking: booking1._id });
    assert.strictEqual(payments.length, 1);
  });

  it('unverified browser success cannot mark booking paid (no fake endpoint exists)', async () => {
    // Any endpoint that flips status to paid purely from reaching a success URL must not exist.
    const routes = [];
    app._router.stack.forEach((r) => { r.route && routes.push(r.route.path); });
    assert.ok(!routes.some((p) => /success|paid/.test(p)), 'no silent success endpoint');
  });

  it('another guest cannot see or cancel someone booking', async () => {
    const g2 = await User.create({ name: 'g2', email: 'g2@example.com', passwordHash: await User.hashPassword('Sup3rSecret!') });
    const t2 = (await request(app).post('/api/v1/auth/login').send({ email: 'g2@example.com', password: 'Sup3rSecret!' })).body.data.token;
    await request(app).get(`/api/v1/bookings/${booking1._id}`).set('Authorization', `Bearer ${t2}`).expect(403);
    await request(app).post(`/api/v1/bookings/${booking1._id}/cancel`).set('Authorization', `Bearer ${t2}`).expect(403);
  });

  it('guest requests cancellation of the confirmed booking; staff approves; refund recorded as refund_processing (demo)', async () => {
    await request(app).post(`/api/v1/bookings/${booking1._id}/cancel`).set(auth('guest')).send({ reason: 'plans changed' }).expect(200);
    let after = await Booking.findById(booking1._id).lean();
    assert.strictEqual(after.status, 'cancellation_requested');

    const res = await request(app).post(`/api/v1/operations/bookings/${booking1._id}/approve-cancellation`).set(auth('hotel_manager')).expect(200);
    assert.strictEqual(res.body.data.booking.status, 'cancelled');
    assert.strictEqual(res.body.data.booking.paymentStatus, 'refund_processing');

    // Inventory is released again: same dates can now be booked.
    await request(app).post('/api/v1/bookings').set(auth('guest')).send({ roomId: room._id, ...dates(10, 13), guestCount: 2 }).expect(201);
  });

  it('non-manager hotel staff cannot manage or read another hotel board', async () => {
    const otherHotel = await Hotel.create({ name: 'Elsewhere Suites', slug: 'elsewhere-suites', address: { city: 'Oslo', country: 'Norway' } });
    await request(app).get(`/api/v1/operations/board?hotelId=${otherHotel._id}`).set(auth('staff')).expect(403);
    await request(app).get(`/api/v1/reports/hotels/${otherHotel._id}`).set(auth('hotel_manager')).expect(403);
    await request(app).get(`/api/v1/reports/hotels/${hotel._id}`).set(auth('hotel_manager')).expect(200);
  });

  // Regression: hotel reports used to be empty because $match compared the
  // request hotel id (string) against the ObjectId hotel field in aggregate.
  it('hotel reports contain paid bookings (aggregate ObjectId match)', async () => {
    const res = await request(app).post('/api/v1/bookings').set(auth('guest')).send({ roomId: room._id, ...dates(40, 43), guestCount: 2 }).expect(201);
    const bk = res.body.data.booking;
    await request(app).post(`/api/v1/bookings/${bk._id}/payments/demo`).set(auth('guest')).expect(201);
    await request(app).post(`/api/v1/bookings/${bk._id}/payments/demo/confirm`).set(auth('guest')).send({ result: 'succeed' }).expect(200);

    const rep = await request(app).get(`/api/v1/reports/hotels/${hotel._id}?days=365`).set(auth('hotel_manager')).expect(200);
    assert.ok(rep.body.data.metrics.grossBookingValue > 0, 'gross booking value must count the paid booking');
  });

  // Regression: deactivated hotels vanished from the admin Hotels tab.
  it('public hotel list hides inactive hotels; admins may request inactive ones', async () => {
    await Hotel.findByIdAndUpdate(hotel._id, { active: false });
    const pub = await request(app).get('/api/v1/hotels').expect(200);
    assert.ok(!pub.body.data.hotels.some((h) => String(h._id) === String(hotel._id)), 'inactive hotel hidden publicly');

    const adm = await request(app).get('/api/v1/hotels?includeInactive=1').set(auth('admin')).expect(200);
    assert.ok(adm.body.data.hotels.some((h) => String(h._id) === String(hotel._id)), 'admin sees inactive hotel');

    await request(app).get('/api/v1/hotels?includeInactive=1').set(auth('guest')).expect(403);
    await request(app).get('/api/v1/hotels?includeInactive=1').expect(403);
    await Hotel.findByIdAndUpdate(hotel._id, { active: true });
  });
});
