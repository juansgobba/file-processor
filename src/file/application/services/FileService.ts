import { Inject, Injectable, Logger } from "@nestjs/common";
import * as fs from "fs";
import * as readline from "readline";
import * as path from "path";
import TYPES from "@/types";
import { IFileService } from "./IFileService";
import { ISQLServerRepository } from "@/file/domain/interfaces/ISQLServerRepository";
import { Client } from "@/file/domain/entities/Client";

const INPUT_FILE_PATH = path.join(process.cwd(), "CLIENTES_IN_0425.dat");
const BATCH_SIZE = 1000; // Tamaño del lote para inserciones masivas

@Injectable()
export class FileService implements IFileService {
  private readonly _sqlServerRepository: ISQLServerRepository;
  private readonly logger = new Logger(FileService.name);

  constructor(
    @Inject(TYPES.ISQLServerRepository) sqlServerRepository: ISQLServerRepository,
  ) {
    this._sqlServerRepository = sqlServerRepository;
  }

  async processFile(): Promise<void> {
    this.logger.log(`Iniciando procesamiento del archivo: ${INPUT_FILE_PATH}`);

    if (!fs.existsSync(INPUT_FILE_PATH)) {
      this.logger.error(`El archivo de entrada no existe: ${INPUT_FILE_PATH}`);
      throw new Error("Archivo de entrada no encontrado.");
    }

    const fileStream = fs.createReadStream(INPUT_FILE_PATH);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    let batch: Client[] = [];
    let lineNumber = 0;
    let processedRecords = 0;
    let errorRecords = 0;

    for await (const line of rl) {
      lineNumber++;
      if (line.trim() === "") {
        continue; // Saltar líneas vacías
      }

      try {
        const client = this.parseClientLine(line, lineNumber);
        batch.push(client);

        if (batch.length >= BATCH_SIZE) {
          await this._sqlServerRepository.saveMany(batch);
          processedRecords += batch.length;
          batch = [];
          this.logger.log(`Líneas procesadas: ${processedRecords}. Errores: ${errorRecords}.`);
        }
      } catch (error) {
        errorRecords++;
        this.logger.warn(`Error en línea ${lineNumber}: ${line}. Mensaje: ${error.message}`);
      }
    }

    // Guardar cualquier registro restante en el último lote
    if (batch.length > 0) {
      try {
        await this._sqlServerRepository.saveMany(batch);
        processedRecords += batch.length;
        this.logger.log(`Líneas procesadas: ${processedRecords}. Errores: ${errorRecords}.`);
      } catch (error) {
        errorRecords += batch.length; // Si falla el lote final, todos son errores
        this.logger.error(`Error al guardar el lote final. Mensaje: ${error.message}`);
      }
    }

    this.logger.log(`Procesamiento finalizado. Total de líneas: ${lineNumber}. Registros procesados: ${processedRecords}. Registros con error: ${errorRecords}.`);
  }

  private parseClientLine(line: string, lineNumber: number): Client {
    const parts = line.split("|");
    if (parts.length !== 7) {
      throw new Error("Formato de línea incorrecto. Se esperaban 7 campos.");
    }

    const [fullName, dni, ingressAt, isPEP, isObligateSubject] = parts.map(p => p.trim());

    const client = new Client();
    client.fullName = fullName;

    // Validación y conversión de DNI
    const parsedDNI = parseInt(dni, 10);
    if (isNaN(parsedDNI) || parsedDNI <= 0) {
      throw new Error(`DNI inválido: "${dni}"`);
    }
    client.dni = parsedDNI;

    // Validación y conversión de Estado
    client.status = true; // Siempre activo al importar

    // Validación y conversión de FechaIngreso
    const dateParts = ingressAt.split('/');
    if (dateParts.length !== 3) {
      throw new Error(`Formato de fecha de ingreso incorrecto: "${ingressAt}". Se esperaba MM/DD/YYYY.`);
    }
    const [month, day, year] = dateParts.map(Number);
    const parsedDate = new Date(year, month - 1, day); // Meses en JS son 0-indexados
    if (isNaN(parsedDate.getTime())) {
      throw new Error(`Fecha de ingreso inválida: "${ingressAt}"`);
    }
    client.ingressAt = parsedDate;

    // Validación y conversión de EsPEP
    if (isPEP === undefined || isPEP === null || isPEP === '') {
      throw new Error(`Valor de EsPEP no puede ser vacío.`);
    }
    client.isPEP = isPEP.toLowerCase() === 'true';

    // Validación y conversión de EsSujetoObligado (puede ser NULL)
    if (isObligateSubject !== undefined && isObligateSubject !== null && isObligateSubject !== '') {
      client.isObligateSubject = isObligateSubject.toLowerCase() === 'true';
    } else {
      client.isObligateSubject = null; // O undefined, dependiendo de cómo TypeORM maneje BIT NULL
    }

    return client;
  }
}
