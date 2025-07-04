import { isRequestUser } from '@/common/context';
import { AuthException, AuthExceptionCode } from '@/common/exceptions';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { hash } from 'argon2';
import { FindOptionsRelations, FindOptionsWhere, Repository } from 'typeorm';
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
        roles: true,
      },
    });
  }

  findOne(
    where: FindOptionsWhere<User>,
    relations?: string[] | FindOptionsRelations<User>,
  ) {
    return this.userRepository.findOne({
      where,
      relations,
    });
  }

  async exist(username: string, email: string) {
    const user = await this.userRepository.findOne({
      where: [{ username }, { email }],
    });

    return !!user;
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    if (isRequestUser(id)) {
      delete updateUserDto.roles;
    }

    const user = await this.userRepository.findOne({
      where: { id },
    });

    if (!user) {
      throw new AuthException(AuthExceptionCode.USER_NOT_FOUND);
    }

    let roles: Role[];

    if (updateUserDto.roles) {
      roles = await this.rolesService.findByCodes(updateUserDto.roles);
    }

    const updatedUser = this.userRepository.merge(user, {
      ...updateUserDto,
      roles,
    });

    return this.userRepository.save(updatedUser);
  }

  async remove(id: string) {
    const result = await this.userRepository.softDelete(id);

    if (result.affected === 0) {
      throw new AuthException(AuthExceptionCode.USER_NOT_FOUND);
    }

    return {
      message: 'User deleted successfully',
    };
  }
}
