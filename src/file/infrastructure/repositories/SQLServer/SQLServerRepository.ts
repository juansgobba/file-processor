import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In } from "typeorm";
import { ISQLServerRepository } from "@/file/domain/interfaces/ISQLServerRepository";
import { Client as ClientEntity } from "@/file/domain/entities/Client";
import { Client as ClientSchema } from "./entities/Client.schema";

@Injectable()
export class SQLServerRepository implements ISQLServerRepository {
  constructor(
    @InjectRepository(ClientSchema)
    private readonly _clientRepository: Repository<ClientSchema>,
  ) {}

  async saveMany(clientEntities: ClientEntity[]): Promise<void> {
    try {
      const clientSchemas = clientEntities.map((entity) => this.toSchema(entity));
      // TypeORM maneja la inserción masiva de forma eficiente con .save() cuando se le pasa un array
      await this._clientRepository.save(clientSchemas, { chunk: 1000 }); // chunk para optimizar la inserción
    } catch (error) {
      console.error("Error al guardar múltiples clientes:", error);
      throw new Error("Error al guardar múltiples clientes en la base de datos.");
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
