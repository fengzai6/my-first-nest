import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private userRepository: Repository<User>,
  ) {}

  create(createUserDto: CreateUserDto) {
    const user = this.userRepository.create(createUserDto);

    console.log('user', user);

    return this.userRepository.save(user);
  }

  findAll(): Promise<User[]> {
    return this.userRepository.find({
      relations: {
        cats: true,
      },
    });
  }

  findOne(id: number) {
    return this.userRepository.findOne({
      where: { id },
      relations: {
        cats: true,
      },
    });
  }

  async update(id: number, updateUserDto: UpdateUserDto) {
    const user = await this.userRepository.findOne({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updatedUser = this.userRepository.merge(user, updateUserDto);

    return this.userRepository.save(updatedUser);
  }

  remove(id: number) {
    return this.userRepository.delete(id);
  }
}
