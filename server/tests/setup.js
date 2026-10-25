const mongoose = require('mongoose');
const crypto = require('crypto');
process.env.NODE_ENV = 'test';

// Tests use a dedicated throwaway database on the locally installed MongoDB.
// The database name is unique per run and dropped at the end, so tests are
// isolated from the dev database and from each other.
const dbName = `roomly_test_tmp_${crypto.randomBytes(4).toString('hex')}`;
const uri = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017';

async function startTestDb() {
  await mongoose.connect(`${uri}/${dbName}`);
  return `${uri}/${dbName}`;
}

async function stopTestDb() {
  try {
    await mongoose.connection.dropDatabase();
  } catch (err) {
    console.error('[test] dropDatabase failed:', err.message);
  }
  await mongoose.disconnect();
}

module.exports = { startTestDb, stopTestDb };
