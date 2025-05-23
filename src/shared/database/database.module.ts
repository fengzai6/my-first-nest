import { AppConfigModule } from '@/config/config.module';
import { getConfig } from '@/config/configuration';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [AppConfigModule],
      useFactory: (configService: ConfigService) => {
        const { database } = getConfig(configService);

        return database;
      },
      inject: [ConfigService],
    }),
  ],
})
export class DatabaseModule {}
// {
//   type: 'postgres',
//   url: process.env.DATABASE_URL,
//   entities: [__dirname + '/**/*.entity{.ts,.js}'],
//   synchronize: true,
//   autoLoadEntities: true,
//   ssl: false,
// }
