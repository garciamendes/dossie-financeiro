import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // SEGURANCA.md, seção 4: headers de segurança e CORS restrito.
  app.use(helmet());
  app.enableCors({
    origin: config.get<string>('FRONTEND_URL', 'http://localhost:3000'),
    credentials: true,
  });

  // Validação estrita de entrada em toda rota — rejeita payload fora do esperado.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableShutdownHooks();

  // 0.0.0.0: plataformas de host (Render, Fly, Railway) exigem bind em todas
  // as interfaces, não só localhost.
  await app.listen(config.get<number>('PORT', 3333), '0.0.0.0');
}
bootstrap();
