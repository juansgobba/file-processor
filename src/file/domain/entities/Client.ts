import { v4 as uuidv4 } from "uuid";

export class Client {
  id: number;
  guid: string;
  fullName: string;
  dni: number;
  status: string;
  ingressAt: Date;
  isPEP: boolean;
  isObligateSubject: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date;
}
