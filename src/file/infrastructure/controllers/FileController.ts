import { Controller, Get, Inject } from "@nestjs/common";
import { IFileService } from "@/file/application/services/IFileService";
import TYPES from "@/types";

@Controller("file")
export class FileController {
  private readonly _fileService: IFileService;

  constructor(@Inject(TYPES.IFileService) fileService: IFileService) {
    this._fileService = fileService;
  }

  @Get("process")
  async processFile() {
    this._fileService.processFile();
  }
}
