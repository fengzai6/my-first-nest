import { AppConfigModule } from '@/config/config.module';
import { getConfig } from '@/config/configuration';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthStrategy } from './strategies/jwt-auth.strategy';

@Module({
  imports: [
    UsersModule,
    JwtModule.registerAsync({
      imports: [AppConfigModule],
      useFactory: (configService: ConfigService) => {
        const { jwt } = getConfig(configService);

        return jwt;
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthStrategy],
})
export class AuthModule {}
