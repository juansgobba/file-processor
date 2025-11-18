import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  BeforeInsert,
} from 'typeorm'; // Importar BeforeInsert
import { v4 as uuidv4 } from 'uuid';

@Entity({ name: 'clients' })
export class Client {
  @PrimaryGeneratedColumn({ type: 'int' })
  id: number;

  @Column({ type: 'uniqueidentifier', unique: true })
  guid: string;

  @Column({ type: 'nvarchar', nullable: false, length: 100 })
  fullName: string;

  @Column({ type: 'bigint', unique: true, nullable: false })
  dni: number;

  @Column({ type: 'nvarchar', nullable: false, length: 10 })
  status: string;

  @Column({ type: 'date', nullable: false })
  ingressAt: Date;

  @Column({ type: 'bit', nullable: false })
  isPEP: boolean;

  @Column({ type: 'bit', nullable: true })
  isObligateSubject: boolean;

  @CreateDateColumn({ type: 'datetime2', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime2', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'datetime2' })
  deletedAt: Date;

  @BeforeInsert()
  generateGuid() {
    if (!this.guid) {
      this.guid = uuidv4();
    }
  }
}
