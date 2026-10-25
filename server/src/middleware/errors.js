function newError(status, code, message, extra) {
  const e = new Error(message);
  e.status = status;
  e.code = code;
  if (extra) Object.assign(e, extra);
  return e;
}

const ValidationError = (msg, details) => newError(400, 'VALIDATION_ERROR', msg, { details });
const NotFound = (msg = 'Resource not found') => newError(404, 'NOT_FOUND', msg);
const Forbidden = (msg = 'Insufficient permissions') => newError(403, 'FORBIDDEN', msg);
const Conflict = (msg) => newError(409, 'CONFLICT', msg);

function notFoundHandler(req, res) {
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `No route: ${req.method} ${req.path}` } });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  let status = err.status || 500;
  let code = err.code || 'INTERNAL_ERROR';
  let message = err.message || 'Something went wrong';

  if (err.name === 'ValidationError') {
    status = 400; code = 'VALIDATION_ERROR'; message = err.message;
  } else if (err.name === 'CastError') {
    status = 400; code = 'INVALID_ID'; message = 'Invalid identifier';
  } else if (err.code === 11000) {
    status = 409; code = 'DUPLICATE'; message = 'Duplicate value for a unique field';
  }
  if (status >= 500 && err.stack) console.error('[error]', err.stack);

  const body = { success: false, error: { code, message } };
  if (err.details) body.error.details = err.details;
  if (process.env.NODE_ENV !== 'production' && status >= 500) body.error.stack = err.stack;
  res.status(status).json(body);
}

// async wrapper so thrown errors hit the central handler
const wrap = (fn) => (req, res, next) => void Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { newError, ValidationError, NotFound, Forbidden, Conflict, notFoundHandler, errorHandler, wrap };
