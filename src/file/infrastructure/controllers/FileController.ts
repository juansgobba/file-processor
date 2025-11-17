import { Controller, Post, Inject, HttpStatus, HttpCode } from "@nestjs/common";
import { IFileService } from "@/file/application/services/IFileService";
import TYPES from "@/types";

@Controller("file")
export class FileController {
  private readonly _fileService: IFileService;

  constructor(@Inject(TYPES.IFileService) fileService: IFileService) {
    this._fileService = fileService;
  }

  @Post("/process")
  @HttpCode(HttpStatus.ACCEPTED) // Indica que la solicitud ha sido aceptada para procesamiento
  processFile() { // No es necesario que sea async si no esperamos el resultado aquí
    this._fileService.processFile();
    return { message: "Procesamiento de archivo iniciado en segundo plano." };
  }
}
