import { Inject, Injectable } from "@nestjs/common";
import * as fs from "fs";
import * as readline from "readline";
import * as path from "path";
import TYPES from "@/types";
import { IFileService } from "./IFileService";
import { ISQLServerRepository } from "@/file/domain/interfaces/ISQLServerRepository";
import { Client } from "@/file/domain/entities/Client";
import { winstonLogger } from "@/file/infrastructure/repositories/logger/winston.logger"; // Importar el logger único

const INPUT_FILE_PATH = path.join(process.cwd(), "CLIENTES_IN_0425.dat"); // Ruta del archivo de entrada
const BATCH_SIZE = 200; // Tamaño del lote para inserciones masivas

@Injectable()
export class FileService implements IFileService {
  private readonly _sqlServerRepository: ISQLServerRepository;
  // private readonly logger = new Logger(FileService.name); // Ya no necesitamos el logger de NestJS directamente aquí

  constructor(
    @Inject(TYPES.ISQLServerRepository) sqlServerRepository: ISQLServerRepository,
  ) {
    this._sqlServerRepository = sqlServerRepository;
  }

  async processFile(): Promise<void> {
    const startTime = process.hrtime.bigint();
    const startCpuUsage = process.cpuUsage();

    winstonLogger.info(`Iniciando procesamiento del archivo: ${INPUT_FILE_PATH}`);

    if (!fs.existsSync(INPUT_FILE_PATH)) {
      winstonLogger.error(`El archivo de entrada no existe: ${INPUT_FILE_PATH}`);
      throw new Error("Archivo de entrada no encontrado.");
    }

    const fileStream = fs.createReadStream(INPUT_FILE_PATH);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    let batch: Client[] = [];
    let lineNumber = 0;
    let totalProcessedRecords = 0;
    let totalErrorRecords = 0;
    let lastLoggedLine = 0; // Para controlar cuándo loguear el progreso

    for await (const line of rl) {
      lineNumber++;
      if (line.trim() === "") {
        continue; // Saltar líneas vacías
      }

      try {
        const client = this.parseClientLine(line, lineNumber);
        if(!client) {
          totalErrorRecords++;
          continue;
        }
        batch.push(client);

        if (batch.length >= BATCH_SIZE) {
          const { processed, errors } = await this.processBatch(batch, lineNumber);
          totalProcessedRecords += processed;
          totalErrorRecords += errors;
          batch = [];

          // Log de métricas de progreso
          this.logProgressMetrics(startTime, startCpuUsage, totalProcessedRecords, totalErrorRecords, lineNumber);
        }
      } catch (error) {
        winstonLogger.error(`Error inesperado al procesar línea ${lineNumber}: ${error.message}`);
        totalErrorRecords++;
      }
    }

    // Guardar cualquier registro restante en el último lote
    if (batch.length > 0) {
      try {
        const { processed, errors } = await this.processBatch(batch, lineNumber, true);
        totalProcessedRecords += processed;
        totalErrorRecords += errors;
      } catch (error) {
        winstonLogger.error(`Error inesperado al procesar el lote final: ${error.message}`);
        totalErrorRecords += batch.length; // Si falla el lote final, todos son errores
      }
    }

    // Log de métricas finales
    this.logFinalMetrics(startTime, startCpuUsage, totalProcessedRecords, totalErrorRecords, lineNumber);
  }

  private async processBatch(batch: Client[], currentLineNumber: number, isFinalBatch: boolean = false): Promise<{ processed: number; errors: number }> {
    let processedInBatch = 0;
    let errorsInBatch = 0;
    const batchIdentifier = isFinalBatch ? 'lote final' : `lote en línea ${currentLineNumber}`;

    // 1. Filtrar duplicados dentro del mismo lote
    const uniqueDnisInBatch = new Set<number>();
    const batchWithoutInternalDuplicates = batch.filter(client => {
      if (uniqueDnisInBatch.has(client.dni)) {
        winstonLogger.warn(`DNI duplicado internamente en el ${batchIdentifier}: ${client.dni}.`);
        errorsInBatch++;
        return false;
      }
      uniqueDnisInBatch.add(client.dni);
      return true;
    });

    // Si no quedan clientes después de filtrar duplicados internos, no hay nada más que hacer
    if (batchWithoutInternalDuplicates.length === 0) {
      return { processed: processedInBatch, errors: errorsInBatch };
    }

    // 2. Consultar la base de datos para encontrar DNIs ya existentes
    const existingDnis = await this._sqlServerRepository.findExistingDnis(batchWithoutInternalDuplicates.map(client => client.dni));
    const existingSet = new Set(existingDnis);

    // 3. Filtrar los clientes que ya existen en la base de datos
    const finalBatchToSave = batchWithoutInternalDuplicates.filter(client => !existingSet.has(client.dni));
    const duplicatedInDbRecords = batchWithoutInternalDuplicates.length - finalBatchToSave.length;

    if (duplicatedInDbRecords > 0) {
      winstonLogger.warn(`Se omitieron ${duplicatedInDbRecords} registros con DNI duplicado en la base de datos en el ${batchIdentifier}.`);
      errorsInBatch += duplicatedInDbRecords;
    }

    // 4. Guardar el lote final y limpio
    if (finalBatchToSave.length > 0) {
      try {
        await this._sqlServerRepository.saveMany(finalBatchToSave);
        processedInBatch += finalBatchToSave.length;
      } catch (error) {
        winstonLogger.error(`Error al guardar el ${batchIdentifier} en la base de datos: ${error.message}`);
        errorsInBatch += finalBatchToSave.length; // Si falla el guardado, todos son errores
      }
    }

    return { processed: processedInBatch, errors: errorsInBatch };
  }

  private parseClientLine(line: string, lineNumber: number): Client {
    try{
    const parts = line.split("|");
    if (parts.length !== 7) throw new Error("Formato de línea incorrecto. Se esperaban 7 campos.");

    const [name, lastName, dni, status, ingressAt, isPEP, isObligateSubject] = parts.map(p => p.trim());

    const client = new Client();

    // Validación para fullName
    if (!name || name.trim() === "") throw new Error(`El nombre (name) no puede estar vacío.`);
    if (name.length > 50) throw new Error(`El nombre (name) no puede exceder los 50 caracteres.`);
    if (!lastName || lastName.trim() === "") throw new Error(`El apellido (lastName) no puede estar vacío.`);
    if (lastName.length > 50) throw new Error(`El apellido (lastName) no puede exceder los 50 caracteres.`);
    client.fullName = `${name} ${lastName}`;

    // Validación y conversión de DNI
    const parsedDNI = parseInt(dni, 10);
    if (isNaN(parsedDNI) || parsedDNI <= 0) throw new Error(`DNI inválido: "${dni}"`);
    client.dni = parsedDNI;

    // Validación y conversión de Estado
    if(status === '' || status === undefined || status === null) throw new Error(`Estado no puede ser vacío.`);
    if(status.length > 10) throw new Error(`El estado no puede exceder los 10 caracteres.`)
    client.status = status;

    // Validación y conversión de FechaIngreso
    const dateParts = ingressAt.split('/');
    if (dateParts.length !== 3) throw new Error(`Formato de fecha de ingreso incorrecto: "${ingressAt}". Se esperaba MM/DD/YYYY.`);
    const [month, day, year] = dateParts.map(Number); // Cambiado a MM/DD/YYYY

    // Validación estricta de día, mes y año
    if (month < 1 || month > 12) throw new Error(`Mes inválido en la fecha de ingreso: "${ingressAt}". El mes debe estar entre 1 y 12.`);
    if (day < 1 || day > 31) throw new Error(`Día inválido en la fecha de ingreso: "${ingressAt}". El día debe estar entre 1 y 31.`);
    if (year < 1900 || year > 2100) throw new Error(`Año inválido en la fecha de ingreso: "${ingressAt}". El año debe estar entre 1900 y 2100.`);

    const parsedDate = new Date(Date.UTC(year, month - 1, day)); // Crear fecha en UTC
    if (isNaN(parsedDate.getTime())) throw new Error(`Fecha de ingreso inválida: "${ingressAt}"`);
    client.ingressAt = parsedDate;

    // Validación y conversión de EsPEP
    if (isPEP === undefined || isPEP === null || isPEP === '') throw new Error(`Valor de EsPEP no puede ser vacío.`);
    client.isPEP = isPEP.toLowerCase() === 'true';

    // Validación y conversión de EsSujetoObligado (puede ser NULL)
    if (isObligateSubject !== undefined && isObligateSubject !== null && isObligateSubject !== '') {
      client.isObligateSubject = isObligateSubject.toLowerCase() === 'true';
    } else {
      client.isObligateSubject = null;
    }

    return client;
  } catch (error) {
    winstonLogger.warn(`Error al parsear línea ${lineNumber}: ${line}. Mensaje: ${error.message}`);
    return null; // Retornar null para indicar que la línea no pudo ser parseada
  }
  }

  private logProgressMetrics(startTime: bigint, startCpuUsage: NodeJS.CpuUsage, totalProcessedRecords: number, totalErrorRecords: number, currentLineNumber: number): void {
    const elapsedHrTime = process.hrtime.bigint() - startTime;
    const elapsedTimeMs = Number(elapsedHrTime / 1_000_000n); // Convertir a milisegundos

    const currentCpuUsage = process.cpuUsage(startCpuUsage);
    const cpuUserMs = currentCpuUsage.user / 1000; // microsegundos a milisegundos
    const cpuSystemMs = currentCpuUsage.system / 1000; // microsegundos a milisegundos

    const memoryUsage = process.memoryUsage();
    const heapUsedMb = (memoryUsage.heapUsed / 1024 / 1024).toFixed(2); // bytes a MB

    winstonLogger.info(
      `[Métricas] Líneas: ${currentLineNumber} | Procesados: ${totalProcessedRecords} | Errores: ${totalErrorRecords} | Tiempo: ${elapsedTimeMs}ms | Memoria: ${heapUsedMb} MB | CPU (User/System): ${cpuUserMs.toFixed(2)}ms/${cpuSystemMs.toFixed(2)}ms`
    );
  }

  private logFinalMetrics(startTime: bigint, startCpuUsage: NodeJS.CpuUsage, totalProcessedRecords: number, totalErrorRecords: number, totalLines: number): void {
    const elapsedHrTime = process.hrtime.bigint() - startTime;
    const elapsedTimeMs = Number(elapsedHrTime / 1_000_000n);

    const finalCpuUsage = process.cpuUsage(startCpuUsage);
    const cpuUserMs = finalCpuUsage.user / 1000;
    const cpuSystemMs = finalCpuUsage.system / 1000;

    const memoryUsage = process.memoryUsage();
    const heapUsedMb = (memoryUsage.heapUsed / 1024 / 1024).toFixed(2);

    winstonLogger.info(`--- Resumen Final ---`);
    winstonLogger.info(`Total de líneas leídas: ${totalLines}`);
    winstonLogger.info(`Registros procesados exitosamente: ${totalProcessedRecords}`);
    winstonLogger.info(`Registros con error: ${totalErrorRecords}`);
    winstonLogger.info(`Tiempo total de procesamiento: ${elapsedTimeMs}ms`);
    winstonLogger.info(`Uso de Memoria (Heap): ${heapUsedMb} MB`);
    winstonLogger.info(`Uso de CPU (User/System): ${cpuUserMs.toFixed(2)}ms/${cpuSystemMs.toFixed(2)}ms`);
  }
}
