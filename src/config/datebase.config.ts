import { registerAs } from '@nestjs/config';

export const databaseConfig = registerAs('database', () => ({
  type: process.env.DATABASE_TYPE,
  url: process.env.DATABASE_URL,
  synchronize: process.env.DATABASE_SYNCHRONIZE || false,
  entities: [__dirname + '/**/*.entity{.ts,.js}'],
}));
