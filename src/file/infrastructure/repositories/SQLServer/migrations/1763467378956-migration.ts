import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1763467378956 implements MigrationInterface {
  name = 'Migration1763467378956';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "file_processor"."clients" ("id" int NOT NULL IDENTITY(1,1), "guid" uniqueidentifier NOT NULL, "fullName" nvarchar(100) NOT NULL, "dni" bigint NOT NULL, "status" nvarchar(10) NOT NULL, "ingressAt" date NOT NULL, "isPEP" bit NOT NULL, "isObligateSubject" bit, "createdAt" datetime2 NOT NULL CONSTRAINT "DF_56f259ca53364919afdabcb104e" DEFAULT getdate(), "updatedAt" datetime2 NOT NULL CONSTRAINT "DF_d66d0b7fa951dac60e81d2c7d63" DEFAULT getdate(), "deletedAt" datetime2, CONSTRAINT "UQ_640387ddf0cb94db8283cb56cfb" UNIQUE ("guid"), CONSTRAINT "UQ_8e645da308339e84f45d6cfe5d4" UNIQUE ("dni"), CONSTRAINT "PK_f1ab7cf3a5714dbc6bb4e1c28a4" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "file_processor"."clients"`);
  }
}
