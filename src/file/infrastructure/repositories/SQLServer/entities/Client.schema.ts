import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, DeleteDateColumn } from "typeorm";
import { v4 as uuidv4 } from "uuid";

@Entity({ name: "clients", schema: `${process.env.DB_SCHEMA}` })
export class Client {
  @PrimaryGeneratedColumn({ type: "int" })
  id: number;

  @Column({ type: "uniqueidentifier", unique: true })
  guid: string;

  @Column({ type: "nvarchar", nullable: false })
  fullName: string;

  @Column({ type: "bigint", unique: true, nullable: false })
  dni: number;

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
