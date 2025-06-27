import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsRelations, Repository } from 'typeorm';
import { RolesService } from '../roles/roles.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private userRepository: Repository<User>,
    private readonly rolesService: RolesService,
  ) {}

  create(user: Partial<User>) {
    const newUser = this.userRepository.create(user);

    console.log('user', user);

    return this.userRepository.save(newUser);
  }

  findAll(): Promise<User[]> {
    return this.userRepository.find({
      relations: {
        // cats: true,
        roles: true,
      },
    });
  }

  findOne(id: string, relations?: string[] | FindOptionsRelations<User>) {
    return this.userRepository.findOne({
      where: { id },
      relations,
    });
  }

  /**
   * @description 查找用户(包括密码)
   * @param username - 用户名
   * @returns 用户
   */
  find(username: string) {
    return this.userRepository.findOne({
      where: { username },
    });
  }

  async exist(username: string, email: string) {
    const user = await this.userRepository.findOne({
      where: [{ username }, { email }],
    });

    return !!user;
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const user = await this.userRepository.findOne({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const roles = await this.rolesService.findByCodes(updateUserDto.roles);

    const updatedUser = this.userRepository.merge(user, {
      ...updateUserDto,
      roles,
    });

    return this.userRepository.save(updatedUser);
  }

  remove(id: string) {
    return this.userRepository.softDelete(id);
  }
}
