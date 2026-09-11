import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';

export function configureApp(app: INestApplication): void {
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableCors({
    origin: trustedWebOrigin(),
    credentials: true,
  });
}

function trustedWebOrigin(): string {
  const configured = process.env.WEB_ORIGIN?.trim();
  if (!configured) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('WEB_ORIGIN is required in production');
    }
    return 'http://localhost:3000';
  }

  const parsed = new URL(configured);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('WEB_ORIGIN must use http or https');
  }
  if (
    parsed.pathname !== '/' ||
    parsed.search ||
    parsed.hash ||
    parsed.username ||
    parsed.password
  ) {
    throw new Error('WEB_ORIGIN must be an origin without path or credentials');
  }
  if (process.env.NODE_ENV === 'production' && parsed.protocol !== 'https:') {
    throw new Error('WEB_ORIGIN must use https in production');
  }
  return parsed.origin;
}
