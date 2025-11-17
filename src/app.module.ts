import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import TYPES from './types';
import { AppController } from './app.controller';
import { FileModule } from './file/file.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'mssql',
      host: 'localhost',
      port: 1433,
      username: 'your_username',
      password: 'your_password',
      database: 'your_database',
      schema: 'dbo',
      autoLoadEntities: true,
      synchronize: false,
    }),
    FileModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
