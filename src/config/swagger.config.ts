import { registerAs } from '@nestjs/config';

export const swaggerConfig = registerAs('swagger', () => ({
  enabled: process.env.SWAGGER_ENABLED === 'true',
  path: process.env.SWAGGER_PATH,
}));
