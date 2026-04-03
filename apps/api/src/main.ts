import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { EnvService } from './modules/env/env.service';

function normalizeOrigin(origin: string): string {
  return origin.endsWith('/') ? origin.slice(0, -1) : origin;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const envService = app.get(EnvService);
  const env = envService.getValues();
  const expressApp = app.getHttpAdapter().getInstance() as {
    set: (setting: string, value: number) => void;
  };
  const allowedOrigin = normalizeOrigin(env.WEB_PUBLIC_URL);

  app.setGlobalPrefix('v1');
  app.enableShutdownHooks();
  expressApp.set('trust proxy', 1);
  app.use(
    helmet({
      crossOriginResourcePolicy: false,
    }),
  );
  app.use(cookieParser());
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (normalizeOrigin(origin) === allowedOrigin) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  });
  app.useGlobalFilters(new AllExceptionsFilter());

  await app.listen(env.API_PORT, env.API_HOST);
}

void bootstrap();
