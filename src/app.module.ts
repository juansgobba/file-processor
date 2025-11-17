import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import TYPES from './types';
import { AppController } from './app.controller';
import { FileController } from './file/infrastructure/controllers/FileController';
import { FileService } from './file/application/services/FileService';
import { SQLServerRepository } from './file/infrastructure/repositories/SQLServer/SQLServerRepository';
import { entities } from './file/infrastructure/repositories/SQLServer/entities/_index';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'mssql',
      host: 'localhost',
      port: 1433,
      username: 'your_username',
      password: 'your_password',
      database: 'your_database',
      schema: 'dbo',
      autoLoadEntities: true,
      synchronize: false,
    }),
    TypeOrmModule.forFeature([...entities])
  ],
  controllers: [AppController, FileController],
  providers: [
    {
      provide: TYPES.IFileService,
      useClass: FileService
    },
    {
      provide: TYPES.ISQLServerRepository,
      useClass: SQLServerRepository
    }
  ],
})
export class AppModule {}
