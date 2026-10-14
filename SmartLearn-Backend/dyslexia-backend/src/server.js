import { app } from './app.js';
import { env } from './config/env.js';
import { connectDatabase } from './config/database.js';

const startServer = async () => {
  const connection = env.mongodbUri ? await connectDatabase() : null;

  if (connection) {
    console.log('MongoDB connected ✅');
  } else {
    console.warn('MONGODB_URI is not set; starting backend without a database connection.');
  }

  app.listen(env.port, () => {
    console.log(`Dyslexia backend listening on port ${env.port}`);
  });
};

if (!process.env.VERCEL) startServer().catch((error) => {
  console.error('Failed to start server:', { type: error.name });
  process.exit(1);
});

export default app;
