import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import TYPES from '../types';
import { FileController } from './infrastructure/controllers/FileController';
import { FileService } from './application/services/FileService';
import { SQLServerRepository } from './infrastructure/repositories/SQLServer/SQLServerRepository';
import { entities } from './infrastructure/repositories/SQLServer/entities/_index';
import { WinstonLoggerRepository } from './infrastructure/repositories/logger/WinstonLoggerRepository'; // Importar el nuevo logger
import { ILogger } from './domain/interfaces/ILogger'; // Importar la interfaz del logger

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
      provide: TYPES.ILogger, // Registrar el nuevo logger
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
      provide: TYPES.ILogger, // Exportar el logger para que otros módulos puedan usarlo
      useClass: WinstonLoggerRepository,
    },
  ],
})
export class FileModule {}
