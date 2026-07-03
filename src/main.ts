import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';

/**
 * FILE PURPOSE
 * ----------------------------------------------------------------------------
 * Application entry point. Wires up the process-wide concerns that must be
 * configured before any request is handled:
 *
 *   - helmet()         Phase 11: sets secure HTTP response headers
 *                       (HSTS, X-Content-Type-Options, etc.)
 *   - ValidationPipe    Phase 11: rejects any request body that doesn't match
 *                       its DTO's class-validator rules, and strips unknown
 *                       fields (`whitelist: true`) so clients can't smuggle
 *                       extra fields into a create/update payload.
 *   - CORS              Restricts which origins may call this API from a
 *                       browser.
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(helmet());

  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? true,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.setGlobalPrefix('api/v1');

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  Logger.log(
    `🚀 Application listening on http://localhost:${port}/api/v1`,
    'Bootstrap',
  );
}
void bootstrap();
