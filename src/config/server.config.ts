import { registerAs } from '@nestjs/config';

export const serverConfig = registerAs('server', () => ({
  port: process.env.PORT,
}));
