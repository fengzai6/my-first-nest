import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { CatsController } from './cats.controller';
import { CatsService } from './cats.service';
import { Cat } from './entities';

@Module({
  imports: [UsersModule, TypeOrmModule.forFeature([Cat])],
  controllers: [CatsController],
  providers: [CatsService],
  exports: [CatsService],
})
export class CatsModule {}
