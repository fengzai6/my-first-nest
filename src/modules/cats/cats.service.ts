import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersService } from '../users/users.service';
import { CreateCatDto } from './dto/create-cat.dto';
import { UpdateCatDto } from './dto/update-cat.dto';
import { Cat } from './entities';
import { BaseException } from '@/common/exceptions';
import { BaseResponse } from '@/common/response/base.response';

@Injectable()
export class CatsService {
  constructor(
    private readonly usersService: UsersService,
    @InjectRepository(Cat) private catRepository: Repository<Cat>,
  ) {}

  create(createCatDto: CreateCatDto) {
    const cat = this.catRepository.create(createCatDto);

    return this.catRepository.save(cat);
  }

  findAll(): Promise<Cat[]> {
    return this.catRepository.find();
  }

  findOne(id: string): Promise<Cat> {
    return this.catRepository.findOneBy({ id });
  }

  // findOneByUuid(uuid: string): string {
  //   return `This action returns a #${uuid} cat`;
  // }

  async updateOwner(id: string, updateCatDto: UpdateCatDto) {
    const cat = await this.findOne(id);

    cat.owner = await this.usersService.findOne({
      id: updateCatDto.ownerId,
    });

    return this.catRepository.save(cat);
  }

  async remove(id: string) {
    const result = await this.catRepository.softDelete(id);

    if (result.affected === 0) {
      throw new BaseException({
        message: 'Cat not found',
        status: HttpStatus.NOT_FOUND,
      });
    }

    return new BaseResponse('Cat deleted successfully');
  }
}
