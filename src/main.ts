import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = new DocumentBuilder()
    .setTitle('File Processor API')
    .setDescription('API para procesar archivos de clientes y volcarlos a SQL Server.')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document); // La documentación estará disponible en /api

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
