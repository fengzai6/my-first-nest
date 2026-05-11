import { AppConfigModule } from '@/config/config.module';
import { getConfig } from '@/config/configuration';
import { WsJwtGuard } from '@/common/guards/ws-jwt.guard';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module';
import { SocketGateway } from './socket.gateway';
import { SocketService } from './socket.service';

@Module({
  imports: [
    UsersModule,
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
  providers: [SocketGateway, SocketService, WsJwtGuard],
  exports: [SocketService],
})
export class SocketModule {}
