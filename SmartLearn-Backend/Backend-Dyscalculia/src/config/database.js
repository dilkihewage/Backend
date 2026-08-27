import mongoose from 'mongoose';

import { env } from './env.js';

export const connectDatabase = async () => {
  if (!env.mongodbUri) {
    throw new Error('MONGODB_URI is required');
  }

  mongoose.set('strictQuery', true);

  const options = {};

  if (env.mongodbDbName) {
    options.dbName = env.mongodbDbName;
  }

  await mongoose.connect(env.mongodbUri, options);
  return mongoose.connection;
};

export const disconnectDatabase = async () => {
  await mongoose.disconnect();
};
