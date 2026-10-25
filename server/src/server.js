const app = require('./app');
const { connectDb, disconnectDb } = require('./config/db');
const env = require('./config/env');
const { startExpiredBookingJob } = require('./jobs/expiredBookings');

let server = null;
let expiryJob = null;

async function start() {
  await connectDb();
  server = app.listen(env.port, () => {
    console.log(`[roomly-server] ${env.nodeEnv} listening on http://localhost:${env.port}`);
  });
  expiryJob = startExpiredBookingJob();
  return server;
}

async function stop() {
  if (expiryJob) expiryJob();
  if (server) await new Promise((r) => server.close(r));
  await disconnectDb();
}

if (require.main === module) {
  start().catch((err) => {
    console.error('[roomly-server] failed to start:', err.message);
    process.exit(1);
  });
  for (const sig of ['SIGINT', 'SIGTERM'] ) {
    process.on(sig, async () => {
      console.log(`\n[roomly-server] ${sig} received, shutting down gracefully`);
      await stop();
      process.exit(0);
    });
  }
}

module.exports = { start, stop, app };
