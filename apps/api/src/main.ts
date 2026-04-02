import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { EnvService } from './modules/env/env.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const envService = app.get(EnvService);
  const env = envService.getValues();
  const expressApp = app.getHttpAdapter().getInstance() as {
    set: (setting: string, value: number) => void;
  };

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
    origin: env.WEB_PUBLIC_URL,
    credentials: true,
  });
  app.useGlobalFilters(new AllExceptionsFilter());

  await app.listen(env.API_PORT, '0.0.0.0');
}

void bootstrap();
