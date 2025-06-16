import * as dotenv from 'dotenv';
import { join } from 'path';
import { DataSource } from 'typeorm';

dotenv.config();

const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [join(__dirname, '../src/**/*.entity{.ts,.js}')],
  synchronize: false,
  migrations: [join(__dirname, '../database/migrations/**/*{.ts,.js}')],
  logging: true,
});

export default AppDataSource;
