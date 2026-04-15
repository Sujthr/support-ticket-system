import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import helmet from 'helmet';
import { AppLogger } from './common/logger/app-logger.service';

async function bootstrap() {
  const bootstrapLogger = new AppLogger();
  try {
    const app = await NestFactory.create<NestExpressApplication>(AppModule, {
      bufferLogs: true,
    });

    const logger = app.get(AppLogger);
    app.useLogger(logger);

    app.setGlobalPrefix('api/v1');

    app.use(helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: false,
    }));

    app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads/' });

    const frontendOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000,http://localhost:3052')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    app.enableCors({ origin: frontendOrigins, credentials: true });
    logger.low(`CORS origins: ${frontendOrigins.join(', ')}`, 'Bootstrap');

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    if (process.env.NODE_ENV !== 'production') {
      const config = new DocumentBuilder()
        .setTitle('Support Ticket System API')
        .setDescription('Multi-tenant customer support ticketing platform')
        .setVersion('1.0')
        .addBearerAuth()
        .build();
      const document = SwaggerModule.createDocument(app, config);
      SwaggerModule.setup('api/docs', app, document);
    }

    const port = Number(process.env.PORT) || 3001;
    await app.listen(port);
    logger.medium(`Server running on http://localhost:${port}`, 'Bootstrap');
    if (process.env.NODE_ENV !== 'production') {
      logger.low(`API Docs: http://localhost:${port}/api/docs`, 'Bootstrap');
    }

    process.on('unhandledRejection', (reason: any) => {
      logger.fatal(`Unhandled rejection: ${reason?.message ?? reason}`, 'Process', {
        stack: reason?.stack,
      });
    });
    process.on('uncaughtException', (err) => {
      logger.fatal(`Uncaught exception: ${err.message}`, 'Process', { stack: err.stack });
    });
  } catch (err: any) {
    bootstrapLogger.fatal(`Bootstrap failed: ${err.message}`, 'Bootstrap', { stack: err.stack });
    process.exit(1);
  }
}
bootstrap();
