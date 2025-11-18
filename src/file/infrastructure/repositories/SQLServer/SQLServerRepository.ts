import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In } from "typeorm";
import { ISQLServerRepository } from "@/file/domain/interfaces/ISQLServerRepository";
import { Client as ClientEntity } from "@/file/domain/entities/Client";
import { Client as ClientSchema } from "./entities/Client.schema";
import { winstonLogger } from "@/file/infrastructure/repositories/logger/winston.logger"; // Importar el logger

@Injectable()
export class SQLServerRepository implements ISQLServerRepository {
  constructor(
    @InjectRepository(ClientSchema)
    private readonly _clientRepository: Repository<ClientSchema>,
  ) {}

  async saveMany(clientEntities: ClientEntity[]): Promise<void> {
    const clientSchemas = clientEntities.map((entity) => this.toSchema(entity));

    try {
      // Intento de inserción masiva
      await this._clientRepository.save(clientSchemas, { chunk: 1000 });
    } catch (error) {
      // Si falla la inserción masiva, intentamos uno por uno para identificar el error específico
      winstonLogger.warn(`Fallo la inserción masiva de ${clientSchemas.length} clientes. Intentando insertar uno por uno.`);
      
      for (const clientSchema of clientSchemas) {
        try {
          await this._clientRepository.save(clientSchema);
        } catch (individualError) {
          // Verificar si es un error de clave duplicada (código 2627 para SQL Server)
          if (individualError.code === 'EREQUEST' && individualError.number === 2627) {
            winstonLogger.warn(
              `Error al guardar cliente (DNI: ${clientSchema.dni}, Nombre: ${clientSchema.fullName}). Razón: DNI duplicado. Este registro fue omitido.`
            );
          } else {
            // Otros errores inesperados al guardar un cliente individual
            winstonLogger.error(
              `Error inesperado al guardar cliente (DNI: ${clientSchema.dni}, Nombre: ${clientSchema.fullName}). Razón: ${individualError.message}`
            );
          }
        }
      }
      // No relanzamos el error original del lote para permitir que el proceso continúe
    }
  }

  async findExistingDnis(dnis: number[]): Promise<number[]> {
    const existingClients = await this._clientRepository.find({
      where: { dni: In(dnis) },
      select: ["dni"]
    });
    return existingClients.map(client => client.dni);
  }

  private toDomain(schema: ClientSchema): ClientEntity {
    if (!schema) return null;
    const domain = new ClientEntity();
    Object.assign(domain, schema);
    return domain;
  }

  private toSchema(domain: ClientEntity): ClientSchema {
    if (!domain) return null;
    const schema = new ClientSchema();
    Object.assign(schema, domain);
    return schema;
  }
}
