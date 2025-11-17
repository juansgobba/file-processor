import { Inject, Injectable } from "@nestjs/common";
import TYPES from "@/types";
import { IFileService } from "./IFileService";
import { ISQLServerRepository } from "@/file/domain/interfaces/ISQLServerRepository";

@Injectable()
export class FileService implements IFileService {
  private readonly _sqlServerRepository: ISQLServerRepository;

  constructor(
    @Inject(TYPES.ISQLServerRepository) sqlServerRepository: ISQLServerRepository,
  ) {
    this._sqlServerRepository = sqlServerRepository;
  }

  async processFile(): Promise<void> {
    console.log("Process");
  }
}
