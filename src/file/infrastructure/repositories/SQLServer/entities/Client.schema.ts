import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, DeleteDateColumn } from "typeorm";
import { v4 as uuidv4 } from "uuid";

@Entity({ name: "client" })
export class Client {
  @PrimaryGeneratedColumn({ type: "int" })
  id: number;

  @Column({ type: "uniqueidentifier", unique: true })
  guid: string;

  @Column({ type: "varchar", nullable: false })
  fullName: string;

  @Column({ type: "bigint", unique: true, nullable: false })
  dni: string;

  @Column({ type: "date", nullable: false })
  ingressAt: Date;

  @Column({ type: "bit", nullable: false })
  isPEP: boolean;

  @Column({ type: "bit", nullable: true })
  isObligateSubject: boolean;

  @CreateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  updatedAt: Date;

  @DeleteDateColumn({ type: "timestamp" })
  deletedAt: Date;

  constructor() {
    if (!this.guid) {
      this.guid = uuidv4();
    }
  }
}
