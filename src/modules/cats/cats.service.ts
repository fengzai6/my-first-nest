import { Injectable } from '@nestjs/common';
import { Cat } from './interfaces/cat.interface';

@Injectable()
export class CatsService {
  private readonly cats: Cat[] = [];

  create(cat: Cat) {
    this.cats.push(cat);
  }

  findAll(): Cat[] {
    return this.cats;
  }

  findOne(id: number): string {
    return `This action returns a #${id} cat`;
  }

  findOneByUuid(uuid: string): string {
    return `This action returns a #${uuid} cat`;
  }
}
