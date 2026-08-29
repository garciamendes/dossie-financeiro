import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // SEGURANCA.md, seção 4: headers de segurança e CORS restrito.
  app.use(helmet());
  app.enableCors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:3000' });

  // Validação estrita de entrada em toda rota — rejeita payload fora do esperado.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));

  await app.listen(process.env.PORT ?? 3333);
}
bootstrap();
