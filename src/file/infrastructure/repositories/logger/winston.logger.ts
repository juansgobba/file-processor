import { createLogger, format, transports } from 'winston';
import * as path from 'path';

const { combine, timestamp, printf, colorize } = format;

const logFormat = printf(({ level, message, timestamp }) => {
  return `${timestamp} [${level}]: ${message}`;
});

// Filtro para mostrar SOLO mensajes de nivel 'info' en la consola
const onlyInfo = format((info) => {
  if (info.level === 'info') {
    return info;
  }
  return false;
});

export const winstonLogger = createLogger({
  level: 'info', // Nivel mínimo global (para que los archivos capturen todo)
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    // logFormat ya no va aquí, se aplica en cada transporte al final
  ),
  transports: [
    new transports.Console({
      level: 'info', // Nivel mínimo para consola (el filtro se encarga de lo demás)
      format: combine(
        onlyInfo(), // Aplicar el filtro para mostrar solo info
        colorize(),
        logFormat, // Aplicar el formato final aquí
      ),
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
