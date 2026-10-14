import { HttpError } from '../utils/httpError.js';

export const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);
  const databaseError = /^(Mongo|MongooseServerSelection|MongooseNetwork)/.test(err.name || '');
  const candidate = databaseError ? 503 : err instanceof HttpError
    ? err.statusCode
    : err.statusCode || 500;
  const statusCode = Number.isInteger(candidate) && candidate >= 400 && candidate <= 599 ? candidate : 500;

  const payload = {
    success: false,
    message: statusCode === 503 ? 'Database unavailable' : statusCode >= 500 ? 'Internal server error' : err.message || 'Request failed',
  };

  if (err instanceof HttpError && statusCode < 500 && err.details) {
    payload.details = err.details;
  }

  if (statusCode >= 500) {
    console.error('Request failed', { method: req.method, statusCode, type: err.name });
  }

  res.status(statusCode).json(payload);
};
