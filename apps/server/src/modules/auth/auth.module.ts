import { AppConfigModule } from '@/config/config.module';
import { getConfig } from '@/config/configuration';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesModule } from '../roles/roles.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RefreshToken } from './entities/refresh-token.entity';
import { RefreshTokenService } from './refresh-token.service';
import { JwtAuthStrategy } from './strategies/jwt-auth.strategy';

@Module({
  imports: [
    TypeOrmModule.forFeature([RefreshToken]),
    UsersModule,
    RolesModule,
    JwtModule.registerAsync({
      imports: [AppConfigModule],
      useFactory: (configService: ConfigService) => {
        const { jwt } = getConfig(configService);

        return {
          secret: jwt.secret,
          signOptions: { expiresIn: jwt.accessExpiresIn },
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthStrategy, RefreshTokenService],
  exports: [RefreshTokenService],
})
export class AuthModule {}
