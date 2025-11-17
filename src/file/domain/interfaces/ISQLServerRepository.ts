import { Client } from "../entities/Client";

export interface ISQLServerRepository {
  save(client: Client): Promise<Client>;
  saveMany(clients: Client[]): Promise<void>;
}
