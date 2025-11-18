import { Client } from "../entities/Client";

export interface ISQLServerRepository {
  saveMany(clients: Client[]): Promise<void>;
}
