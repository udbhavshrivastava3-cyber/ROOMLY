require('dotenv').config();

const required = (name, fallback) => {
  const v = process.env[name] || fallback;
  return v;
};

const env = {
  nodeEnv: required('NODE_ENV', 'development'),
  port: parseInt(process.env.PORT || '5000', 10),
  mongodbUri: required('MONGODB_URI', 'mongodb://127.0.0.1:27017/roomly?replicaSet=rs0'),
  clientUrl: required('CLIENT_URL', 'http://localhost:5173'),
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  cookieName: process.env.COOKIE_NAME || 'roomly_token',
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.EMAIL_FROM || 'Roomly <no-reply@roomly.local>',
  },
  paymentProvider: process.env.PAYMENT_PROVIDER || 'demo',
  stripeKey: process.env.STRIPE_SECRET_KEY || '',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  // Tax model (server-side only):
  //  - GST slabs are the default (Indian room-rent slabs, per-night basis).
  //  - Setting TAX_RATE_PCT explicitly forces a flat percentage instead.
  taxRatePct: process.env.TAX_RATE_PCT === undefined || process.env.TAX_RATE_PCT === ''
    ? null
    : parseFloat(process.env.TAX_RATE_PCT),
  serviceChargePct: parseFloat(process.env.SERVICE_CHARGE_PCT || '5'),
};

const problems = [];
if (!env.mongodbUri) problems.push('MONGODB_URI is required');
if (env.nodeEnv !== 'test' && !env.jwtSecret) problems.push('JWT_SECRET is required');
if (env.nodeEnv !== 'test' && env.jwtSecret && env.jwtSecret.length < 32) {
  problems.push('JWT_SECRET must be at least 32 characters in non-test environments');
}
if (process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY.startsWith('sk_live')) {
  problems.push('Live payment keys are not allowed for local development');
}

if (problems.length) {
  // eslint-disable-next-line no-console
  console.error('[config] Invalid environment configuration:\n - ' + problems.join('\n - '));
  process.exit(1);
}

module.exports = env;
