import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ISQLServerRepository } from "@/file/domain/interfaces/ISQLServerRepository";
import { Client as ClientEntity } from "@/file/domain/entities/Client";
import { Client as ClientSchema } from "./entities/Client.schema";

@Injectable()
export class SQLServerRepository implements ISQLServerRepository {
  constructor(
    @InjectRepository(ClientSchema)
    private readonly _clientEntity: Repository<ClientSchema>,
  ) {}

  async save(clientEntity: ClientEntity): Promise<ClientEntity> {
    try {
      const clientSchema = this.toSchema(clientEntity);
      const savedClient = await this._clientEntity.save(clientSchema);
      return this.toDomain(savedClient);
    } catch (error) {
      throw new Error();
    }
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
