import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { Cat } from './cat.entity';
import { CatsController } from './cats.controller';
import { CatsService } from './cats.service';

@Module({
  imports: [UsersModule, TypeOrmModule.forFeature([Cat])],
  controllers: [CatsController],
  providers: [CatsService],
  exports: [CatsService],
})
export class CatsModule {}
