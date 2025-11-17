import "reflect-metadata";
import { DataSource } from "typeorm";
import "dotenv/config";
import { entities } from "@/file/infrastructure/repositories/SQLServer/entities/_index";

export const AppDataSource = new DataSource({
  type: "mssql",
  host: `${process.env.DB_HOST}`,
  port: Number(process.env.DB_PORT),
  username: `${process.env.DB_USER}`,
  password: `${process.env.DB_PASSWORD}`,
  database: `${process.env.DB_NAME}`,
  schema: `${process.env.DB_SCHEMA}`,
  entities: entities,
  migrations: ["src/file/infrastructure/repositories/SQLServer/migrations/*.ts"],
  synchronize: false,
  logging: false,
});

// to initialize initial connection with the database, register all entities
// and "synchronize" database schema, call "initialize()" method of a newly created database
// once in your application bootstrap
AppDataSource.initialize()
  .then(() => {
    // here you can start to work with your database
  })
  .catch((error) => console.log(error));