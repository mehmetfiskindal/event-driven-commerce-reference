import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import { AppModule } from './app.module';
import type { AppEnvironment } from './shared/config/environment.schema';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Event-Driven Commerce Reference')
    .setDescription(
      'Demo order-processing backend with NestJS, Prisma, RabbitMQ, and PostgreSQL.',
    )
    .setVersion('0.1.0')
    .build();
  const openApiDocument = SwaggerModule.createDocument(app, swaggerConfig);

  SwaggerModule.setup('docs', app, cleanupOpenApiDoc(openApiDocument));

  const configService =
    app.get<ConfigService<AppEnvironment, true>>(ConfigService);
  const port = configService.get('PORT', { infer: true });

  await app.listen(port);
}

void bootstrap();
