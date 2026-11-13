import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module.js';

const REQUIRED_PRODUCTION_VARS = [
  'DATABASE_URL',
  'JWT_SECRET',
  'FRONTEND_URL',
];

function validateEnv(): void {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }
  const missing = REQUIRED_PRODUCTION_VARS.filter(
    (key) => !process.env[key] || String(process.env[key]).trim() === '',
  );
  if (missing.length > 0) {
    throw new Error(
      `Environment variable wajib tidak terisi di production: ${missing.join(', ')}`,
    );
  }
  if (process.env.JWT_SECRET === 'secret') {
    throw new Error('JWT_SECRET tidak boleh menggunakan nilai default di production.');
  }
}

async function bootstrap() {
  validateEnv();
  const app = await NestFactory.create(AppModule);

  app.use(helmet());

  const corsOrigins = (process.env.CORS_ORIGINS ?? process.env.FRONTEND_URL ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : true,
    credentials: true,
  });

  app.enableShutdownHooks();

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
}
await bootstrap();
