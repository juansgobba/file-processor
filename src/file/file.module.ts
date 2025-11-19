import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import TYPES from '../types';
import { FileController } from './infrastructure/controllers/FileController';
import { FileService } from './application/services/FileService';
import { SQLServerRepository } from './infrastructure/repositories/SQLServer/SQLServerRepository';
import { entities } from './infrastructure/repositories/SQLServer/entities/_index';
import { WinstonLoggerRepository } from './infrastructure/repositories/logger/WinstonLoggerRepository';

@Module({
  imports: [TypeOrmModule.forFeature([...entities])],
  controllers: [FileController],
  providers: [
    {
      provide: TYPES.IFileService,
      useClass: FileService,
    },
    {
      provide: TYPES.ISQLServerRepository,
      useClass: SQLServerRepository,
    },
    {
      provide: TYPES.ILogger,
      useClass: WinstonLoggerRepository,
    },
  ],
  exports: [
    {
      provide: TYPES.IFileService,
      useClass: FileService,
    },
    {
      provide: TYPES.ISQLServerRepository,
      useClass: SQLServerRepository,
    },
    {
      provide: TYPES.ILogger,
      useClass: WinstonLoggerRepository,
    },
  ],
})
export class FileModule {}
