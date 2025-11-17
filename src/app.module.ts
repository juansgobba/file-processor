import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config'; // Importar ConfigModule
import TYPES from './types';
import { AppController } from './app.controller';
import { FileModule } from './file/file.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // Hace que las variables de entorno estén disponibles globalmente
    }),
    TypeOrmModule.forRoot({
      type: 'mssql',
      host: `${process.env.DB_HOST}`,
      port: Number(`${process.env.DB_PORT}`),
      username: `${process.env.DB_USER}`,
      password: `${process.env.DB_PASSWORD}`,
      database: `${process.env.DB_NAME}`,
      schema: `${process.env.DB_SCHEMA}`,
      autoLoadEntities: true,
      synchronize: false,
      extra: {
        trustServerCertificate: true, // Necesario para SQL Server en Docker con certificados autofirmados
      },
    }),
    FileModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
