import { SnakeNamingStrategy } from '@/shared/database/snake-naming.strategy';
import * as dotenv from 'dotenv';
import { join } from 'path';
import { DataSource } from 'typeorm';

dotenv.config();

const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  synchronize: false,
  entities: [join(__dirname, '../src/**/*.entity{.ts,.js}')],
  migrations: [join(__dirname, '../database/migrations/**/*{.ts,.js}')],
  // logging: true,
  namingStrategy: new SnakeNamingStrategy(),
});

export default AppDataSource;
