import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const cookieParser = require('cookie-parser');
import { AppModule } from './app.module';
import { json, urlencoded } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  app.use(
    helmet({
      crossOriginResourcePolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(cookieParser());
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ limit: '50mb', extended: true }));

  // ── CORS — must specify exact origin when withCredentials: true ──
  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://192.168.1.4:3000',
      'http://192.168.1.5:3000',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('NotifyTechAI API')
    .setDescription('Multi-tenant WhatsApp SaaS')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();

  SwaggerModule.setup(
    'api/docs',
    app,
    SwaggerModule.createDocument(app, config),
  );

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`🚀 Backend running on http://localhost:${port}`);
  console.log(`📚 Swagger at http://localhost:${port}/api/docs`);
}

bootstrap();
