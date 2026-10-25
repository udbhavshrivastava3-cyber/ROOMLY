const request = require('supertest');
const assert = require('assert');
const { startTestDb, stopTestDb } = require('./setup');
const { User } = require('../src/models/User');

describe('Authentication @auth', () => {
  let app;

  before(async () => {
    await startTestDb();
    process.env.JWT_SECRET = 'x'.repeat(40);
    app = require('../src/app');
  });
  after(async () => {
    await stopTestDb();
  });

  const guest = { name: 'Grace Guest', email: 'grace@example.com', password: 'Sup3rSecret!' };

  it('registers a guest, hashes the password, never accepts role from the client', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...guest, role: 'admin' }) // attempted mass assignment
      .expect(200);
    assert.strictEqual(res.body.data.user.role, 'guest');
    const dbUser = await User.findOne({ email: guest.email });
    assert.ok(dbUser.passwordHash.startsWith('$2'));
    assert.notStrictEqual(dbUser.passwordHash, guest.password);
  });

  it('rejects duplicate email with 409', async () => {
    const res = await request(app).post('/api/v1/auth/register').send(guest).expect(409);
    assert.strictEqual(res.body.error.code, 'DUPLICATE');
  });

  it('rejects weak passwords and invalid emails', async () => {
    await request(app).post('/api/v1/auth/register').send({ name: 'weak', email: 'bad', password: 'short' }).expect(400);
    await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'wp', email: 'wp@example.com', password: 'alllowercase1!' })
      .expect(400);
  });

  it('logs in with correct credentials and sets HttpOnly cookie', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: guest.email, password: guest.password }).expect(200);
    assert.ok(res.headers['set-cookie'][0].includes('HttpOnly'));
    assert.ok(res.body.data.token);
  });

  it('rejects wrong password with uniform error (no enumeration)', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: guest.email, password: 'WrongPassword1' }).expect(401);
    assert.strictEqual(res.body.error.code, 'INVALID_CREDENTIALS');
  });

  it('rejects unknown user identically to wrong password', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'ghost@example.com', password: 'Whatever123' }).expect(401);
    assert.strictEqual(res.body.error.code, 'INVALID_CREDENTIALS');
  });

  it('GET /auth/me requires authentication', async () => {
    await request(app).get('/api/v1/auth/me').expect(401);
  });

  it('returns the current user when authenticated', async () => {
    const login = await request(app).post('/api/v1/auth/login').send({ email: guest.email, password: guest.password });
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${login.body.data.token}`).expect(200);
    assert.strictEqual(res.body.data.user.email, guest.email);
  });

  it('rejects a forged token (session invalidation matters here)', async () => {
    await request(app).get('/api/v1/auth/me').set('Authorization', 'Bearer not-a-jwt').expect(401);
  });

  it('logout clears the cookie', async () => {
    const res = await request(app).post('/api/v1/auth/logout').expect(200);
    const cookie = res.headers['set-cookie'][0];
    assert.ok(/Expires=Thu, 01 Jan 1970|Max-Age=0/.test(cookie), `expected cleared cookie, got ${cookie}`);
  });
});
