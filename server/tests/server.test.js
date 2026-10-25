const { startTestDb, stopTestDb } = require('./setup');
const request = require('supertest');
const assert = require('assert');

describe('Roomly server bootstrap', () => {
  before(async () => {
    await startTestDb();
    process.env.JWT_SECRET = 'x'.repeat(40);
    app = require('../src/app');
  });
  after(async () => {
    await stopTestDb();
  });

  let app;

  it('GET /api/v1/health returns ok', async () => {
    const res = await request(app).get('/api/v1/health').expect(200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.app, 'Roomly API');
  });

  it('GET /api/v1/ready returns ready against the in-memory DB', async () => {
    const res = await request(app).get('/api/v1/ready').expect(200);
    assert.strictEqual(res.body.data.status, 'ready');
  });

  it('unknown route returns structured 404', async () => {
    const res = await request(app).get('/api/v1/nothing').expect(404);
    assert.strictEqual(res.body.error.code, 'NOT_FOUND');
  });
});
