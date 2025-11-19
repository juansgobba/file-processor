import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SQLServerRepository } from '@/file/infrastructure/repositories/SQLServer/SQLServerRepository';
import { Client as ClientSchema } from '@/file/infrastructure/repositories/SQLServer/entities/Client.schema';
import { Client as ClientEntity } from '@/file/domain/entities/Client';
import { ILogger } from '@/file/domain/interfaces/ILogger';
import TYPES from '@/types';

describe('SQLServerRepository', () => {
  let repository: SQLServerRepository;
  let typeOrmRepository: Repository<ClientSchema>;
  let logger: ILogger;

  const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  beforeEach(async () => {
    const mockTypeOrmRepository = {
      save: jest.fn(),
      find: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SQLServerRepository,
        {
          provide: getRepositoryToken(ClientSchema),
          useValue: mockTypeOrmRepository,
        },
        {
          provide: TYPES.ILogger,
          useValue: mockLogger,
        },
      ],
    }).compile();

    repository = module.get<SQLServerRepository>(SQLServerRepository);
    typeOrmRepository = module.get<Repository<ClientSchema>>(
      getRepositoryToken(ClientSchema),
    );
    logger = module.get<ILogger>(TYPES.ILogger);

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('saveMany', () => {
    it('debe guardar múltiples clientes correctamente', async () => {
      // Arrange
      const clients = [
        createTestClient(1, 'Juan Perez'),
        createTestClient(2, 'Maria Lopez'),
      ];
      (typeOrmRepository.save as jest.Mock).mockResolvedValue(clients);

      // Act
      await repository.saveMany(clients);

      // Assert
      expect(typeOrmRepository.save).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ dni: 1, fullName: 'Juan Perez' }),
          expect.objectContaining({ dni: 2, fullName: 'Maria Lopez' }),
        ]),
        { chunk: 1000 },
      );
    });

    it('debe manejar errores de inserción masiva e intentar uno por uno', async () => {
      // Arrange
      const clients = [
        createTestClient(1, 'Juan Perez'),
        createTestClient(2, 'Maria Lopez'),
      ];
      const error = new Error('Error de inserción masiva');
      (typeOrmRepository.save as jest.Mock)
        .mockRejectedValueOnce(error) // Falla la inserción masiva
        .mockResolvedValueOnce(clients[0]) // Éxito con el primer cliente
        .mockResolvedValueOnce(clients[1]); // Éxito con el segundo cliente

      // Act
      await repository.saveMany(clients);

      // Assert
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Fallo la inserción masiva'),
        'SQLServerRepository',
      );
      expect(typeOrmRepository.save).toHaveBeenCalledTimes(3);
    });

    it('debe manejar errores de duplicados al insertar uno por uno', async () => {
      // Arrange
      const clients = [createTestClient(1, 'Juan Perez')];
      const duplicateError = {
        code: 'EREQUEST',
        number: 2627,
        message: 'Duplicate key error',
      };
      (typeOrmRepository.save as jest.Mock)
        .mockRejectedValueOnce(new Error('Error masivo'))
        .mockRejectedValueOnce(duplicateError);

      // Act
      await repository.saveMany(clients);

      // Assert
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Error al guardar cliente (DNI: 1, Nombre: Juan Perez). Razón: DNI duplicado',
        ),
        'SQLServerRepository',
      );
    });

    it('debe registrar errores inesperados al guardar clientes individuales', async () => {
      // Arrange
      const clients = [createTestClient(1, 'Juan Perez')];
      const unexpectedError = new Error('Error inesperado');
      (typeOrmRepository.save as jest.Mock)
        .mockRejectedValueOnce(new Error('Error masivo'))
        .mockRejectedValueOnce(unexpectedError);

      // Act
      await repository.saveMany(clients);

      // Assert
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          'Error inesperado al guardar cliente (DNI: 1, Nombre: Juan Perez)',
        ),
        expect.any(String),
        'SQLServerRepository',
      );
    });
  });

  describe('findExistingDnis', () => {
    it('debe devolver los DNIs que ya existen en la base de datos', async () => {
      // Arrange
      const dnis = [1, 2, 3];
      const existingClients = [{ dni: 1 }, { dni: 3 }];
      (typeOrmRepository.find as jest.Mock).mockResolvedValue(existingClients);

      // Act
      const result = await repository.findExistingDnis(dnis);

      // Assert
      expect(typeOrmRepository.find).toHaveBeenCalledWith({
        where: { dni: expect.any(Object) },
        select: ['dni'],
      });
      expect(result).toEqual([1, 3]);
    });

    it('debe devolver un array vacío si no existen DNIs', async () => {
      // Arrange
      const dnis = [1, 2, 3];
      (typeOrmRepository.find as jest.Mock).mockResolvedValue([]);

      // Act
      const result = await repository.findExistingDnis(dnis);

      // Assert
      expect(result).toEqual([]);
    });
  });
});

// Helper function para crear clientes de prueba
function createTestClient(dni: number, fullName: string): ClientEntity {
  const client = new ClientEntity();
  client.dni = dni;
  client.fullName = fullName;
  client.status = 'ACTIVO';
  client.ingressAt = new Date();
  client.isPEP = false;
  client.isObligateSubject = false;
  return client;
}
