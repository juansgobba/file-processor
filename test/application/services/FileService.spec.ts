import { Test, TestingModule } from '@nestjs/testing';
import { FileService } from '@/file/application/services/FileService';
import { ISQLServerRepository } from '@/file/domain/interfaces/ISQLServerRepository';
import { ILogger } from '@/file/domain/interfaces/ILogger';
import TYPES from '@/types';
import * as fs from 'fs';
import * as path from 'path';
import { Client } from '@/file/domain/entities/Client';
import { Readable } from 'stream';

jest.mock('fs');
jest.mock('path');

describe('FileService', () => {
  let service: FileService;
  let sqlServerRepository: ISQLServerRepository;
  let logger: ILogger;

  const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  const mockSqlServerRepository = {
    saveMany: jest.fn(),
    findExistingDnis: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FileService,
        {
          provide: TYPES.ISQLServerRepository,
          useValue: mockSqlServerRepository,
        },
        {
          provide: TYPES.ILogger,
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get<FileService>(FileService);
    sqlServerRepository = module.get<ISQLServerRepository>(
      TYPES.ISQLServerRepository,
    );
    logger = module.get<ILogger>(TYPES.ILogger);

    // Reset mocks
    jest.clearAllMocks();
    (fs.existsSync as jest.Mock).mockReset();
    (fs.createReadStream as jest.Mock).mockReset();
    (path.join as jest.Mock).mockReturnValue('mock/path/CLIENTES_IN_0425.dat');
  });

  describe('processFile', () => {
    it('debe lanzar error si el archivo no existe', async () => {
      // Arrange
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      // Act & Assert
      await expect(service.processFile()).rejects.toThrow(
        'Archivo de entrada no encontrado.',
      );
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('El archivo de entrada no existe'),
        null,
        'FileService',
      );
    });

    it('debe procesar correctamente un archivo con registros válidos', async () => {
      // Arrange
      const mockFileContent =
        'Juan|Perez|12345678|ACTIVO|11/15/2023|true|true\n' +
        'Maria|Lopez|87654321|INACTIVO|11/16/2023|false|false';

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.createReadStream as jest.Mock).mockReturnValue(
        Readable.from(mockFileContent),
      );
      mockSqlServerRepository.findExistingDnis.mockResolvedValue([]);
      mockSqlServerRepository.saveMany.mockResolvedValue(undefined);

      // Act
      await service.processFile();

      // Assert
      expect(mockSqlServerRepository.saveMany).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Iniciando procesamiento del archivo'),
        'FileService',
      );
    }, 10000); // Aumentamos el timeout por si acaso

    it('debe filtrar registros duplicados dentro del mismo lote', async () => {
      // Arrange
      const mockFileContent =
        'Juan|Perez|12345678|ACTIVO|11/15/2023|true|true\n' +
        'Maria|Lopez|12345678|INACTIVO|11/16/2023|false|false'; // Mismo DNI

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.createReadStream as jest.Mock).mockReturnValue(
        Readable.from(mockFileContent),
      );
      mockSqlServerRepository.findExistingDnis.mockResolvedValue([]);

      // Act
      await service.processFile();

      // Assert
      expect(mockSqlServerRepository.saveMany).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ dni: 12345678, fullName: 'Juan Perez' }),
        ]),
      );
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('DNI duplicado internamente'),
        'FileService',
      );
    }, 10000);

    it('debe filtrar registros que ya existen en la base de datos', async () => {
      // Arrange
      const mockFileContent =
        'Juan|Perez|12345678|ACTIVO|11/15/2023|true|true\n' +
        'Maria|Lopez|87654321|INACTIVO|11/16/2023|false|false';

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.createReadStream as jest.Mock).mockReturnValue(
        Readable.from(mockFileContent),
      );
      mockSqlServerRepository.findExistingDnis.mockResolvedValue([12345678]); // DNI existente

      // Act
      await service.processFile();

      // Assert
      expect(mockSqlServerRepository.saveMany).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ dni: 87654321, fullName: 'Maria Lopez' }),
        ]),
      );
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Se omitieron 1 registros con DNI duplicado'),
        'FileService',
      );
    }, 10000);

    it('debe manejar errores de parseo de líneas', async () => {
      // Arrange
      const mockFileContent =
        'Juan|Perez|invalid_dni|ACTIVO|11/15/2023|true|true\n' + // DNI inválido
        'Maria|Lopez|87654321|INACTIVO|11/16/2023|false|false';

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.createReadStream as jest.Mock).mockReturnValue(
        Readable.from(mockFileContent),
      );
      mockSqlServerRepository.findExistingDnis.mockResolvedValue([]);

      // Act
      await service.processFile();

      // Assert
      expect(mockSqlServerRepository.saveMany).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ dni: 87654321, fullName: 'Maria Lopez' }),
        ]),
      );
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Error al parsear línea'),
        'FileService',
      );
    }, 10000);

    it('debe manejar errores al guardar en la base de datos', async () => {
      // Arrange
      const mockFileContent = 'Juan|Perez|12345678|ACTIVO|11/15/2023|true|true';

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.createReadStream as jest.Mock).mockReturnValue(
        Readable.from(mockFileContent),
      );
      mockSqlServerRepository.findExistingDnis.mockResolvedValue([]);
      mockSqlServerRepository.saveMany.mockRejectedValue(
        new Error('Error de base de datos'),
      );

      // Act
      await service.processFile();

      // Assert
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error al guardar el lote'),
        expect.any(String),
        'FileService',
      );
    }, 10000);
  });
});
