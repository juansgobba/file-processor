import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config'; // Importar ConfigModule y ConfigService
import TYPES from './types';
import { AppController } from './app.controller';
import { FileModule } from './file/file.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // Hace que las variables de entorno estén disponibles globalmente
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule], // Importar ConfigModule para poder inyectar ConfigService
      useFactory: (configService: ConfigService) => ({
        type: 'mssql',
        host: configService.get<string>('DB_HOST'),
        port: Number(configService.get<string>('DB_PORT')),
        username: configService.get<string>('DB_USER'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_NAME'),
        schema: configService.get<string>('DB_SCHEMA'),
        autoLoadEntities: true,
        synchronize: false,
        extra: {
          trustServerCertificate: true, // Necesario para SQL Server en Docker con certificados autofirmados
        },
      }),
      inject: [ConfigService], // Inyectar ConfigService
    }),
    FileModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
