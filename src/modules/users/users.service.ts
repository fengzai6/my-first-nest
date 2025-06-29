import { AuthException, AuthExceptionCode } from '@/common/exceptions';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { hash } from 'argon2';
import { FindOptionsRelations, Repository } from 'typeorm';
import { Role } from '../roles/entities';
import { RolesService } from '../roles/roles.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private userRepository: Repository<User>,
    private readonly rolesService: RolesService,
  ) {}

  async create(createUserDto: CreateUserDto) {
    const isExist = await this.exist(
      createUserDto.username,
      createUserDto.email,
    );

    if (isExist) {
      throw new AuthException(AuthExceptionCode.USER_ALREADY_EXISTS);
    }

    const hashedPassword = await hash(createUserDto.password, {
      timeCost: 5,
    });

    let roles: Role[];

    if (createUserDto.roles && createUserDto.roles.length > 0) {
      roles = await this.rolesService.findByCodes(createUserDto.roles);
    }

    const newUser = this.userRepository.create({
      ...createUserDto,
      password: hashedPassword,
      roles,
    });

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
      throw new AuthException(AuthExceptionCode.USER_NOT_FOUND);
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
