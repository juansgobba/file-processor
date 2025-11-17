import { v4 as uuidv4 } from "uuid";

export class Client {
  id: number;
  guid: string;
  fullName: string;
  dni: string;
  ingressAt: Date;
  isPEP: boolean;
  isObligateSubject?: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date;

  constructor() {
    if (!this.guid) {
      this.guid = uuidv4();
    }
  }
}
