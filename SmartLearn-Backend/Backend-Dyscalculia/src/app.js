import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import { env, isProduction } from './config/env.js';
import { dyscalculiaRouter } from './routes/dyscalculiaRoutes.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';

export const createApp = () => {
  const app = express();

  app.use(helmet());
  app.use(cors({
    origin: env.clientOrigins.length > 0 ? env.clientOrigins : true,
    credentials: true,
  }));
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(morgan(isProduction ? 'combined' : 'dev'));

  app.get('/health', (req, res) => {
    res.json({ success: true, message: 'Dyscalculia backend is healthy' });
  });

  app.use('/api/dyscalculia', rateLimit({
    windowMs: 60 * 1000,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false,
  }));

  app.use('/api/dyscalculia', dyscalculiaRouter);

  app.get('/', (req, res) => {
    res.json({
      success: true,
      service: 'dyscalculia-backend',
      version: '1.0.0',
    });
  });

  app.use(notFound);
  app.use(errorHandler);

  return app;
};

export const app = createApp();
