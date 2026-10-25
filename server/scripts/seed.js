// Seed script (development only).
// Usage: npm run seed        -> additive seed
//        npm run seed:reset  -> wipes the target DB collections first
// Safety: refuses to run when NODE_ENV=production.
const mongoose = require('mongoose');
if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to seed a production environment.');
  process.exit(1);
}

const { connectDb, disconnectDb } = require('../src/config/db');
const { User } = require('../src/models/User');
const { Hotel } = require('../src/models/Hotel');
const { RoomCategory } = require('../src/models/RoomCategory');
const { Room } = require('../src/models/Room');
const { Booking } = require('../src/models/Booking');
const { Payment } = require('../src/models/Payment');
const { BookingNightLock } = require('../src/services/availability');

const DEMO_PASSWORD = 'RoomlyDemo123';

async function seed() {
  const isReset = process.argv.includes('--reset');
  await connectDb();
  if (isReset) {
    await Promise.all([
      User.deleteMany({}), Hotel.deleteMany({}), RoomCategory.deleteMany({}), Room.deleteMany({}),
      Booking.deleteMany({}), Payment.deleteMany({}), BookingNightLock.deleteMany({}),
      mongoose.connection.collection('notifications').deleteMany({}),
      mongoose.connection.collection('auditlogs').deleteMany({}),
      mongoose.connection.collection('reviews').deleteMany({}),
      mongoose.connection.collection('servicerequests').deleteMany({}),
      mongoose.connection.collection('housekeepingtasks').deleteMany({}),
    ]);
    console.log('[seed] cleared existing collections');
  }

  const passwordHash = await User.hashPassword(DEMO_PASSWORD);
  const users = {};
  for (const [name, email, role] of [
    ['Aarav Mehta', 'guest@roomly.demo', 'guest'],
    ['Priya Nair', 'staff@roomly.demo', 'staff'],
    ['Rohan Sharma', 'manager@roomly.demo', 'hotel_manager'],
    ['Aditi Rao', 'admin@roomly.demo', 'admin'],
  ]) {
    users[email] = await User.findOneAndUpdate(
      { email }, { $set: { name, email, passwordHash, role } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  const hotels = [
    { name: 'Lumen Palace Jaipur', slug: 'lumen-palace-jaipur', city: 'Jaipur', state: 'Rajasthan', country: 'India',
      line1: '18 Amber Road, Civil Lines', phone: '+91 141 234 5000', email: 'stay@lumenpalace.demo', currency: 'INR',
      description: 'DEMO PROPERTY (fictional) — a restored 1920s pink-sandstone haveli hotel with a courtyard baradari, jharokha suites and a rooftop spa overlooking Nahargarh hills.',
      amenities: ['Courtyard spa', 'Rooftop pool', 'Rajasthani thali fine dining', '24h concierge'], images: ['https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=900&q=70'],
      cats: [
        { name: 'Jharokha Deluxe King', capacity: 2, basePrice: 9500, amenities: ['King bed', 'Jharokha window view', 'Nespresso'], bedConfiguration: '1 King bed' },
        { name: 'Sheesh Mahal Suite', capacity: 3, basePrice: 18500, amenities: ['Living room', 'Soaking tub', 'Butler service'], bedConfiguration: '1 King + Sofa bed' },
        { name: 'Maharaja Signature Suite', capacity: 4, basePrice: 42000, amenities: ['Private terrace', 'Feel like royalty pantry', 'Butler service'], bedConfiguration: '2 King beds' },
      ] },
    { name: 'Aurora Cove Goa', slug: 'aurora-cove-goa', city: 'Anjuna', state: 'Goa', country: 'India',
      line1: 'Off Anjuna Beach Road, Bardez', phone: '+91 832 655 2400', email: 'stay@auroracove.demo', currency: 'INR',
      description: 'DEMO PROPERTY (fictional) — cliffside Goan-white villas with private courtyard pools, a sunset deck above Anjuna beach and a Konkan-coast kitchen.',
      amenities: ['Private plunge pool', 'Beachfront dining', 'Ayurveda spa', 'Scooter concierge'], images: ['https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=900&q=70'],
      cats: [
        { name: 'Garden Villa Queen', capacity: 2, basePrice: 7900, amenities: ['Queen bed', 'Garden sit-out', 'Cypress courtyard'], bedConfiguration: '1 Queen bed' },
        { name: 'Cliffside Pool Suite', capacity: 3, basePrice: 15400, amenities: ['Private plunge pool', 'Sunset deck', 'Konkan kitchen dining'], bedConfiguration: '1 King + daybed' },
        { name: 'Cove Presidential Villa', capacity: 4, basePrice: 38000, amenities: ['Two pools', 'Private chef', 'Sea-facing plunge deck'], bedConfiguration: '2 King beds' },
      ] },
    { name: 'Hydrana House Kochi', slug: 'hydrana-house-kochi', city: 'Kochi', state: 'Kerala', country: 'India',
      line1: 'Kunnumpuram Lane, Fort Kochi', phone: '+91 484 262 7100', email: 'stay@hydrana.demo', currency: 'INR',
      description: 'DEMO PROPERTY (fictional) — a heritage spice-trade godown turned boutique hotel on the Fort Kochi backwaters, with chettinad tile floors, rain showers and Chinese-fishing-net views.',
      amenities: ['Backwater decks', 'Spice-market breakfast', 'Kathakali evenings', 'Temple-yoga terrace'], images: ['https://images.unsplash.com/photo-1602002418082-a4443e081dd1?auto=format&fit=crop&w=900&q=70'],
      cats: [
        { name: 'Spice Loft Queen', capacity: 2, basePrice: 6800, amenities: ['Queen bed', 'Courtyard light well', 'Rain shower'], bedConfiguration: '1 Queen bed' },
        { name: 'Backwater Deck Suite', capacity: 3, basePrice: 12800, amenities: ['Private backwater deck', 'Kathakali lounge', 'Butler service'], bedConfiguration: '1 King + daybed' },
        { name: 'Kettuvallam Signature Suite', capacity: 4, basePrice: 26500, amenities: ['Houseboat-style loungeroom', 'Two terraces', 'Private chef on request'], bedConfiguration: '2 Queen beds' },
      ] },
  ];
  const categoriesByHotel = {};
  for (const h of hotels) {
    const hotel = await Hotel.findOneAndUpdate(
      { slug: h.slug },
      { $set: { name: h.name, address: { line1: h.line1, city: h.city, state: h.state, country: h.country }, contact: { phone: h.phone, email: h.email }, description: h.description, amenities: h.amenities, images: h.images, currency: h.currency, managers: [users['manager@roomly.demo']._id, users['staff@roomly.demo']._id] } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    categoriesByHotel[h.slug] = { hotel, categories: [] };

    const cats = h.cats;
    for (const c of cats) {
      const category = await RoomCategory.findOneAndUpdate(
        { hotel: hotel._id, name: c.name },
        { $set: { ...c, hotel: hotel._id } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      categoriesByHotel[h.slug].categories.push(category);
    }
  }

  // Physical rooms: exactly 4 rooms per category (upsert for idempotent re-seeding)
  const allHotels = await Hotel.find({});
  for (const hotel of allHotels) {
    const cats = await RoomCategory.find({ hotel: hotel._id });
    for (const c of cats) {
      for (let i = 1; i <= 4; i++) {
        const roomNumber = `${i}${String(c.name).slice(0, 1).toUpperCase()}${i}`;
        await Room.findOneAndUpdate(
          { hotel: hotel._id, roomNumber },
          { $set: { hotel: hotel._id, roomCategory: c._id, roomNumber, floor: i <= 2 ? 2 : 5 } },
          { upsert: true, setDefaultsOnInsert: true }
        );
      }
    }
  }

  console.log('[seed] hotels, categories and rooms created');
  console.log('[seed] demo accounts (development only):');
  console.log('  guest@roomly.demo / staff@roomly.demo / manager@roomly.demo / admin@roomly.demo');
  console.log(`  password for all: ${DEMO_PASSWORD}`);
  console.log('[seed] sample bookings are created through the normal booking flow in the UI demo.');
  await disconnectDb();
}

seed().catch(async (err) => {
  console.error('[seed] failed:', err.message);
  process.exit(1);
});
