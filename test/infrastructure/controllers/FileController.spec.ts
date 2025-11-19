import { Test, TestingModule } from '@nestjs/testing';
import { FileController } from '@/file/infrastructure/controllers/FileController';
import { IFileService } from '@/file/application/services/IFileService';
import TYPES from '@/types';
import { HttpStatus } from '@nestjs/common';

describe('FileController', () => {
  let controller: FileController;
  let fileService: IFileService;

  beforeEach(async () => {
    // Mock del FileService
    const mockFileService = {
      processFile: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FileController],
      providers: [
        {
          provide: TYPES.IFileService,
          useValue: mockFileService,
        },
      ],
    }).compile();

    controller = module.get<FileController>(FileController);
    fileService = module.get<IFileService>(TYPES.IFileService);
  });

  describe('processFile', () => {
    it('debe llamar a fileService.processFile y devolver mensaje de éxito', () => {
      // Act
      const result = controller.processFile();

      // Assert
      expect(fileService.processFile).toHaveBeenCalled();
      expect(result).toEqual({
        message: 'Procesamiento de archivo iniciado en segundo plano.',
      });
    });

    it('debe devolver código de estado 202 (Accepted)', () => {
      // Arrange
      const metadata = Reflect.getMetadata(
        '__httpCode__',
        controller.processFile,
      );

      // Assert
      expect(metadata).toBe(HttpStatus.ACCEPTED);
    });
  });
});
