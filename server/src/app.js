const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookie = require('cookie-parser');
const mongoose = require('mongoose');

const env = require('./config/env');
const { optionalAuth } = require('./middleware/auth');
const { notFoundHandler, errorHandler } = require('./middleware/errors');
const { apiLimiter } = require('./middleware/rateLimit');
const { cookieMiddleware } = require('./config/cookies');

const app = express();

app.set('trust proxy', 1);
app.use(helmet());
app.use(express.json({ limit: '100kb' }));

// Explicit CORS allowlist with credentials for the JWT cookie.
app.use(
  cors({
    origin(origin, cb) {
      const allowed = [env.clientUrl];
      if (env.nodeEnv === 'test') allowed.push('http://localhost:5173', 'http://127.0.0.1:5173');
      if (!origin || allowed.includes(origin)) return cb(null, true);
      return cb(new Error('Origin not allowed by CORS policy'));
    },
    credentials: true,
  })
);
app.use(cookie());
app.use(cookieMiddleware);
app.use(morgan('tiny'));

app.use(optionalAuth);

// ---- API v1 ----
const api = express.Router();
api.use(apiLimiter);

api.get('/health', (req, res) => {
  res.json({
    success: true,
    data: { app: 'Roomly API', version: 'v1', status: 'ok', uptimeSec: Math.round(process.uptime()), timestamp: new Date().toISOString() },
  });
});

app.use('/api/v1', api);

// Route modules are required lazily by routers that need DB (keeps import safe).
api.use('/auth', require('./routes/authRoutes'));
api.use(require('./routes/apiRoutes'));

api.get('/ready', async (_req, res) => {
  try {
    await mongoose.connection.db.command({ ping: 1 });
    res.json({ success: true, data: { status: 'ready', database: 'connected' } });
  } catch {
    res.status(503).json({ success: false, error: { code: 'NOT_READY', message: 'Database unavailable' } });
  }
});

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
