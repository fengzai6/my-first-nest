import { AuditedSubscriber } from '@/common/subscribers/audited.subscriber';
import { AppConfigModule } from '@/config/config.module';
import { getConfig } from '@/config/configuration';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SnakeNamingStrategy } from './snake-naming.strategy';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [AppConfigModule],
      useFactory: (configService: ConfigService) => {
        const { database } = getConfig(configService);

        return {
          ...database,
          // entities: [__dirname + '/**/*.entity{.ts,.js}'],
          autoLoadEntities: true,
          namingStrategy: new SnakeNamingStrategy(),
          subscribers: [AuditedSubscriber],
        };
      },
      inject: [ConfigService],
    }),
  ],
})
export class DatabaseModule {}
