import { Inject, Injectable, Logger } from "@nestjs/common";
import * as fs from "fs";
import * as readline from "readline";
import * as path from "path";
import TYPES from "@/types";
import { IFileService } from "./IFileService";
import { ISQLServerRepository } from "@/file/domain/interfaces/ISQLServerRepository";
import { Client } from "@/file/domain/entities/Client";

const INPUT_FILE_PATH = path.join(process.cwd(), "CLIENTES_IN_0425.dat");
const BATCH_SIZE = 200; // Tamaño del lote para inserciones masivas

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
    console.time("inicio");
    // this.logger.log(`Iniciando procesamiento del archivo: ${INPUT_FILE_PATH}`);

    if (!fs.existsSync(INPUT_FILE_PATH)) {
      // this.logger.error(`El archivo de entrada no existe: ${INPUT_FILE_PATH}`);
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
        if(!client) {
          continue;
        }
        batch.push(client);

        if (batch.length >= BATCH_SIZE) {
          await this._sqlServerRepository.saveMany(batch);
          processedRecords += batch.length;
          batch = [];
          // this.logger.log(`Líneas procesadas: ${processedRecords}. Errores: ${errorRecords}.`);
        }
      } catch (error) {
        errorRecords++;
        // this.logger.warn(`Error en línea ${lineNumber}: ${line}. Mensaje: ${error.message}`);
      }
    }

    // Guardar cualquier registro restante en el último lote
    if (batch.length > 0) {
      try {
        await this._sqlServerRepository.saveMany(batch);
        processedRecords += batch.length;
        // this.logger.log(`Líneas procesadas: ${processedRecords}. Errores: ${errorRecords}.`);
      } catch (error) {
        errorRecords += batch.length; // Si falla el lote final, todos son errores
        // this.logger.error(`Error al guardar el lote final. Mensaje: ${error.message}`);
      }
    }

    // this.logger.log(`Procesamiento finalizado. Total de líneas: ${lineNumber}. Registros procesados: ${processedRecords}. Registros con error: ${errorRecords}.`);
    console.timeEnd("inicio");
  }

  private parseClientLine(line: string, lineNumber: number): Client {
    try{
    const parts = line.split("|");
    if (parts.length !== 7) {
      throw new Error("Formato de línea incorrecto. Se esperaban 7 campos.");
    }

    const [name, lastName, dni, status, ingressAt, isPEP, isObligateSubject] = parts.map(p => p.trim());

    const client = new Client();

    // Validación para fullName
    const fullName = `${name} ${lastName}`;
    if (!fullName || fullName.trim() === "") {
      throw new Error(`El nombre completo (fullName) no puede estar vacío.`);
    }
    if (fullName.length > 100) {
      throw new Error(`El nombre completo (fullName) no puede exceder los 100 caracteres.`);
    }
    client.fullName = fullName;

    // Validación y conversión de DNI
    const parsedDNI = parseInt(dni, 10);
    if (isNaN(parsedDNI) || parsedDNI <= 0) {
      throw new Error(`DNI inválido: "${dni}"`);
    }
    client.dni = parsedDNI;

    // Validación y conversión de Estado
    if(status === '' || status === undefined || status === null) {
      throw new Error(`Estado no puede ser vacío.`);
    }
    if(status.length > 10) {
      throw new Error(`El estado no puede exceder los 10 caracteres.`)
    }
    client.status = status;

    // Validación y conversión de FechaIngreso
    const dateParts = ingressAt.split('/');
    if (dateParts.length !== 3) {
      throw new Error(`Formato de fecha de ingreso incorrecto: "${ingressAt}". Se esperaba DD/MM/YYYY.`);
    }
    const [day, month, year] = dateParts.map(Number); // Cambiado a DD/MM/YYYY

    // Validación estricta de día, mes y año
    if (month < 1 || month > 12) {
      throw new Error(`Mes inválido en la fecha de ingreso: "${ingressAt}". El mes debe estar entre 1 y 12.`);
    }
    if (day < 1 || day > 31) { // Simplificado, una validación más precisa de días por mes sería más compleja
      throw new Error(`Día inválido en la fecha de ingreso: "${ingressAt}". El día debe estar entre 1 y 31.`);
    }
    if (year < 1900 || year > 2100) { // Rango de años razonable
      throw new Error(`Año inválido en la fecha de ingreso: "${ingressAt}". El año debe estar entre 1900 y 2100.`);
    }

    const parsedDate = new Date(Date.UTC(year, month - 1, day)); // Crear fecha en UTC
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
  } catch (error) {
    this.logger.warn(`Error al parsear línea ${lineNumber}: ${line}. Mensaje: ${error.message}`);
    return null; // Retornar null para indicar que la línea no pudo ser parseada
  }
  }
}
