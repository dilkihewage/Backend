import mongoose from 'mongoose';
import { env } from './env.js';
import { HttpError } from '../utils/httpError.js';

let connectionPromise;
mongoose.set('strictQuery', true);

export const connectDatabase = async () => {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (!env.mongodbUri) throw new HttpError(503, 'Database unavailable');
  if (!connectionPromise) {
    connectionPromise = Promise.resolve().then(() => mongoose.connect(env.mongodbUri, {
      ...(env.mongodbDbName ? { dbName: env.mongodbDbName } : {}),
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
      socketTimeoutMS: 10000,
      maxPoolSize: 5,
    })).then(() => mongoose.connection).catch((error) => {
      // Connection messages may contain credentials. Log only the error class.
      console.error('MongoDB connection failed', { type: error.name });
      throw new HttpError(503, 'Database unavailable');
    }).finally(() => { connectionPromise = undefined; });
  }
  return connectionPromise;
};

export const disconnectDatabase = async () => {
  if (connectionPromise) await connectionPromise.catch(() => {});
  await mongoose.disconnect();
};
