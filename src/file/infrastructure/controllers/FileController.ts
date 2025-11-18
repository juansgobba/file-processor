import { Controller, Post, Inject, HttpStatus, HttpCode } from "@nestjs/common";
import { IFileService } from "@/file/application/services/IFileService";
import TYPES from "@/types";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger"; // Importar decoradores de Swagger

@ApiTags('File') // Agrega una etiqueta para agrupar endpoints en Swagger UI
@Controller("file")
export class FileController {
  private readonly _fileService: IFileService;

  constructor(@Inject(TYPES.IFileService) fileService: IFileService) {
    this._fileService = fileService;
  }

  @Post("/process")
  @HttpCode(HttpStatus.ACCEPTED) // Indica que la solicitud ha sido aceptada para procesamiento
  @ApiOperation({ summary: 'Inicia el procesamiento del archivo de clientes' }) // Descripción de la operación
  @ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Procesamiento de archivo iniciado en segundo plano.' }) // Respuesta exitosa
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Error interno del servidor.' }) // Posible error
  processFile() { // No es necesario que sea async si no esperamos el resultado aquí
    this._fileService.processFile();
    return { message: "Procesamiento de archivo iniciado en segundo plano." };
  }
}
