import { Inject, Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as readline from 'readline';
import * as path from 'path';
import TYPES from '@/types';
import { IFileService } from './IFileService';
import { ISQLServerRepository } from '@/file/domain/interfaces/ISQLServerRepository';
import { ILogger } from '@/file/domain/interfaces/ILogger';
import { Client } from '@/file/domain/entities/Client';

const BATCH_SIZE = 200; // Tamaño del lote para inserciones masivas
const INPUT_FILE_PATH = path.join(process.cwd(), 'CLIENTES_IN_0425.dat'); // Ruta del archivo de entrada

@Injectable()
export class FileService implements IFileService {
  private readonly _sqlServerRepository: ISQLServerRepository; // Inyectar la interfaz de la base de datos
  private readonly _logger: ILogger; // Inyectar la interfaz del logger

  constructor(
    @Inject(TYPES.ISQLServerRepository)
    sqlServerRepository: ISQLServerRepository,
    @Inject(TYPES.ILogger) logger: ILogger,
  ) {
    this._sqlServerRepository = sqlServerRepository;
    this._logger = logger;
  }

  async processFile(): Promise<void> {
    // Métricas iniciales
    const startTime = process.hrtime.bigint();
    const startCpuUsage = process.cpuUsage();

    // Log de inicio
    this._logger.info(
      `Iniciando procesamiento del archivo: ${INPUT_FILE_PATH}`,
      FileService.name,
    );

    // Valido si el archivo existe
    if (!fs.existsSync(INPUT_FILE_PATH)) {
      this._logger.error(
        `El archivo de entrada no existe: ${INPUT_FILE_PATH}`,
        null,
        FileService.name,
      );
      throw new Error('Archivo de entrada no encontrado.');
    }

    // Hago la lectura por linea en streams
    const fileStream = fs.createReadStream(INPUT_FILE_PATH);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    // Inicio variables para el procesamiento
    let batch: Client[] = [];
    let lineNumber = 0;
    let totalProcessedRecords = 0;
    let totalErrorRecords = 0;

    // Comienzo el procesamiento linea por linea
    for await (const line of rl) {
      lineNumber++;
      if (line.trim() === '') {
        continue; // Saltar líneas vacías
      }

      try {
        const client = this.parseClientLine(line, lineNumber);
        if (!client) {
          totalErrorRecords++;
          continue;
        }
        batch.push(client);

        // Ir guardando por lote
        if (batch.length >= BATCH_SIZE) {
          const { processed, errors } = await this.processBatch(
            batch,
            lineNumber,
          );
          totalProcessedRecords += processed;
          totalErrorRecords += errors;
          batch = [];

          // Log de métricas de progreso
          this.logProgressMetrics(
            startTime,
            startCpuUsage,
            totalProcessedRecords,
            totalErrorRecords,
            lineNumber,
          );
        }
      } catch (error) {
        this._logger.error(
          `Error inesperado al procesar línea ${lineNumber}: ${error.message}`,
          error.stack,
          FileService.name,
        );
        totalErrorRecords++;
      }
    }

    // Guardar cualquier registro restante en el último lote
    if (batch.length > 0) {
      try {
        const { processed, errors } = await this.processBatch(
          batch,
          lineNumber,
          true,
        );
        totalProcessedRecords += processed;
        totalErrorRecords += errors;
      } catch (error) {
        this._logger.error(
          `Error inesperado al procesar el lote final: ${error.message}`,
          error.stack,
          FileService.name,
        );
        totalErrorRecords += batch.length; // Si falla el lote final, todos son errores
      }
    }

    // Log de métricas finales
    this.logFinalMetrics(
      startTime,
      startCpuUsage,
      totalProcessedRecords,
      totalErrorRecords,
      lineNumber,
    );
  }

  private async processBatch(
    batch: Client[],
    currentLineNumber: number,
    isFinalBatch: boolean = false,
  ): Promise<{ processed: number; errors: number }> {
    let processedInBatch = 0;
    let errorsInBatch = 0;
    const batchIdentifier = isFinalBatch
      ? 'lote final'
      : `lote en línea ${currentLineNumber}`;

    // 1. Filtrar duplicados dentro del mismo lote
    const uniqueDnisInBatch = new Set<number>();
    const batchWithoutInternalDuplicates = batch.filter((client) => {
      if (uniqueDnisInBatch.has(client.dni)) {
        this._logger.warn(
          `DNI duplicado internamente en el ${batchIdentifier}: ${client.dni}.`,
          FileService.name,
        );
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
    const existingDnis = await this._sqlServerRepository.findExistingDnis(
      batchWithoutInternalDuplicates.map((client) => client.dni),
    );
    const existingSet = new Set(existingDnis);

    // 3. Filtrar los clientes que ya existen en la base de datos
    const finalBatchToSave = batchWithoutInternalDuplicates.filter(
      (client) => !existingSet.has(client.dni),
    );
    const duplicatedInDbRecords =
      batchWithoutInternalDuplicates.length - finalBatchToSave.length;

    if (duplicatedInDbRecords > 0) {
      this._logger.warn(
        `Se omitieron ${duplicatedInDbRecords} registros con DNI duplicado en la base de datos en el ${batchIdentifier}.`,
        FileService.name,
      );
      errorsInBatch += duplicatedInDbRecords;
    }

    // 4. Guardar el lote final y limpio
    if (finalBatchToSave.length > 0) {
      try {
        await this._sqlServerRepository.saveMany(finalBatchToSave);
        processedInBatch += finalBatchToSave.length;
      } catch (error) {
        this._logger.error(
          `Error al guardar el ${batchIdentifier} en la base de datos: ${error.message}`,
          error.stack,
          FileService.name,
        );
        errorsInBatch += finalBatchToSave.length; // Si falla el guardado, todos son errores
      }
    }

    return { processed: processedInBatch, errors: errorsInBatch };
  }

  private parseClientLine(line: string, lineNumber: number): Client {
    try {
      const parts = line.split('|');
      if (parts.length !== 7)
        throw new Error('Formato de línea incorrecto. Se esperaban 7 campos.');

      const [name, lastName, dni, status, ingressAt, isPEP, isObligateSubject] =
        parts.map((p) => p.trim());

      const client = new Client();

      // Validación para fullName
      if (!name || name.trim() === '')
        throw new Error(`El nombre (name) no puede estar vacío.`);
      if (name.length > 50)
        throw new Error(`El nombre (name) no puede exceder los 50 caracteres.`);
      if (!lastName || lastName.trim() === '')
        throw new Error(`El apellido (lastName) no puede estar vacío.`);
      if (lastName.length > 50)
        throw new Error(
          `El apellido (lastName) no puede exceder los 50 caracteres.`,
        );
      client.fullName = `${name} ${lastName}`;

      // Validación y conversión de DNI
      const parsedDNI = parseInt(dni, 10);
      if (isNaN(parsedDNI) || parsedDNI <= 0)
        throw new Error(`DNI inválido: "${dni}"`);
      client.dni = parsedDNI;

      // Validación y conversión de Estado
      if (status === '' || status === undefined || status === null)
        throw new Error(`Estado no puede ser vacío.`);
      if (status.length > 10)
        throw new Error(`El estado no puede exceder los 10 caracteres.`);
      client.status = status;

      // Validación y conversión de FechaIngreso
      const dateParts = ingressAt.split('/');
      if (dateParts.length !== 3)
        throw new Error(
          `Formato de fecha de ingreso incorrecto: "${ingressAt}". Se esperaba MM/DD/YYYY.`,
        );
      const [month, day, year] = dateParts.map(Number); // Cambiado a MM/DD/YYYY

      // Validación estricta de día, mes y año
      if (month < 1 || month > 12)
        throw new Error(
          `Mes inválido en la fecha de ingreso: "${ingressAt}". El mes debe estar entre 1 y 12.`,
        );
      if (day < 1 || day > 31)
        throw new Error(
          `Día inválido en la fecha de ingreso: "${ingressAt}". El día debe estar entre 1 y 31.`,
        );
      if (year < 1900 || year > 2100)
        throw new Error(
          `Año inválido en la fecha de ingreso: "${ingressAt}". El año debe estar entre 1900 y 2100.`,
        );

      const parsedDate = new Date(Date.UTC(year, month - 1, day)); // Crear fecha en UTC
      if (isNaN(parsedDate.getTime()))
        throw new Error(`Fecha de ingreso inválida: "${ingressAt}"`);
      client.ingressAt = parsedDate;

      // Validación y conversión de EsPEP
      if (isPEP === undefined || isPEP === null || isPEP === '')
        throw new Error(`Valor de EsPEP no puede ser vacío.`);
      client.isPEP = isPEP.toLowerCase() === 'true';

      // Validación y conversión de EsSujetoObligado (puede ser NULL)
      if (
        isObligateSubject !== undefined &&
        isObligateSubject !== null &&
        isObligateSubject !== ''
      ) {
        client.isObligateSubject = isObligateSubject.toLowerCase() === 'true';
      } else {
        client.isObligateSubject = null;
      }

      return client;
    } catch (error) {
      this._logger.warn(
        `Error al parsear línea ${lineNumber}: ${line}. Mensaje: ${error.message}`,
        FileService.name,
      );
      return null; // Retornar null para indicar que la línea no pudo ser parseada
    }
  }

  private logProgressMetrics(
    startTime: bigint,
    startCpuUsage: NodeJS.CpuUsage,
    totalProcessedRecords: number,
    totalErrorRecords: number,
    currentLineNumber: number,
  ): void {
    const elapsedHrTime = process.hrtime.bigint() - startTime;
    const elapsedTimeMs = Number(elapsedHrTime / 1_000_000n); // Convertir a milisegundos

    const currentCpuUsage = process.cpuUsage(startCpuUsage);
    const cpuUserMs = currentCpuUsage.user / 1000; // microsegundos a milisegundos
    const cpuSystemMs = currentCpuUsage.system / 1000; // microsegundos a milisegundos

    const memoryUsage = process.memoryUsage();
    const heapUsedMb = (memoryUsage.heapUsed / 1024 / 1024).toFixed(2); // bytes a MB

    this._logger.info(
      `[Métricas] Líneas: ${currentLineNumber} | Procesados: ${totalProcessedRecords} | Errores: ${totalErrorRecords} | Tiempo: ${elapsedTimeMs}ms | Memoria: ${heapUsedMb} MB | CPU (User/System): ${cpuUserMs.toFixed(2)}ms/${cpuSystemMs.toFixed(2)}ms`,
      FileService.name,
    );
  }

  private logFinalMetrics(
    startTime: bigint,
    startCpuUsage: NodeJS.CpuUsage,
    totalProcessedRecords: number,
    totalErrorRecords: number,
    totalLines: number,
  ): void {
    const elapsedHrTime = process.hrtime.bigint() - startTime;
    const elapsedTimeMs = Number(elapsedHrTime / 1_000_000n);

    const finalCpuUsage = process.cpuUsage(startCpuUsage);
    const cpuUserMs = finalCpuUsage.user / 1000;
    const cpuSystemMs = finalCpuUsage.system / 1000;

    const memoryUsage = process.memoryUsage();
    const heapUsedMb = (memoryUsage.heapUsed / 1024 / 1024).toFixed(2);

    this._logger.info(`--- Resumen Final ---`, FileService.name);
    this._logger.info(
      `Total de líneas leídas: ${totalLines}`,
      FileService.name,
    );
    this._logger.info(
      `Registros procesados exitosamente: ${totalProcessedRecords}`,
      FileService.name,
    );
    this._logger.info(
      `Registros con error: ${totalErrorRecords}`,
      FileService.name,
    );
    this._logger.info(
      `Tiempo total de procesamiento: ${elapsedTimeMs}ms`,
      FileService.name,
    );
    this._logger.info(
      `Uso de Memoria (Heap): ${heapUsedMb} MB`,
      FileService.name,
    );
    this._logger.info(
      `Uso de CPU (User/System): ${cpuUserMs.toFixed(2)}ms/${cpuSystemMs.toFixed(2)}ms`,
      FileService.name,
    );
  }
}
