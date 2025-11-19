import { Injectable } from '@nestjs/common';
import {
  createLogger,
  format,
  transports,
  Logger as WinstonLoggerType,
} from 'winston';
import * as path from 'path';
import { ILogger } from '@/file/domain/interfaces/ILogger';

const { combine, timestamp, printf, colorize } = format;

const logFormat = printf(({ level, message, timestamp }) => {
  return `${timestamp} [${level.toUpperCase()}]: ${message}`;
});

@Injectable()
export class WinstonLoggerRepository implements ILogger {
  private readonly logger: WinstonLoggerType;

  constructor() {
    this.logger = createLogger({
      level: 'info', // Nivel mínimo global (para que los archivos capturen todo)
      format: combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss' })),
      transports: [
        new transports.Console({
          level: 'info', // Mostrar info, warn y error
          format: combine(colorize(), logFormat),
        }),
        new transports.File({
          filename: path.join(process.cwd(), 'errors.log'),
          level: 'error', // Solo errores irán a este archivo
          format: combine(
            timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            logFormat, // Aplicar el formato final aquí
          ),
        }),
        new transports.File({
          filename: path.join(process.cwd(), 'warnings.log'),
          level: 'warn', // Advertencias y errores irán a este archivo
          format: combine(
            timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            logFormat, // Aplicar el formato final aquí
          ),
        }),
      ],
    });
  }

  info(message: string, context?: string): void {
    this.logger.info(context ? `[${context}] ${message}` : message);
  }

  warn(message: string, context?: string): void {
    this.logger.warn(context ? `[${context}] ${message}` : message);
  }

  error(message: string, trace?: string, context?: string): void {
    this.logger.error(context ? `[${context}] ${message}` : message, trace);
  }
}
