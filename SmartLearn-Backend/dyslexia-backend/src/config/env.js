import dotenv from 'dotenv';

dotenv.config();

const parseOrigins = (value) => {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
};

export const env = {
  port: Number(process.env.PORT || 5000),
  nodeEnv: process.env.NODE_ENV || 'development',
  mongodbUri: process.env.MONGODB_URI || '',
  mongodbDbName: process.env.MONGODB_DB_NAME || '',
  clientOrigins: [...new Set(['https://r26-it-114-jflg.vercel.app', ...parseOrigins(process.env.CLIENT_ORIGIN)])],
};

export const isProduction = env.nodeEnv === 'production';
