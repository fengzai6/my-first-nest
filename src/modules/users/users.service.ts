import { isRequestUser, useRequestUser } from '@/common/context';
import { SpecialRolesEnum } from '@/common/decorators';
import { AuthException, AuthExceptionCode } from '@/common/exceptions';
import { BaseResponse } from '@/common/response/base.response';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { hash, verify } from 'argon2';
import {
  FindOptionsRelations,
  FindOptionsWhere,
  In,
  Not,
  Repository,
} from 'typeorm';
import { PermissionsService } from '../permissions/permissions.service';
import { Role } from '../roles/entities';
import { RolesService } from '../roles/roles.service';
import { CreateUserDto } from './dto/create-user.dto';
import {
  UpdatePasswordByAdminDto,
  UpdatePasswordDto,
} from './dto/update-password';
import {
  UpdateUserDto,
  UpdateUserRolesDto,
  UpdateUserSpecialRolesDto,
} from './dto/update-user.dto';
import { User } from './entities';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private userRepository: Repository<User>,
    private readonly rolesService: RolesService,
    private readonly permissionsService: PermissionsService,
    private readonly configService: ConfigService,
  ) {}

  async create(createUserDto: CreateUserDto) {
    const isExist = await this.userRepository.exists({
      where: [
        { username: createUserDto.username },
        { email: createUserDto.email },
      ],
    });

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

  async getProfile() {
    const { id: userId } = useRequestUser();

    const user = await this.findOne({ id: userId }, { roles: true });

    return user;
  }

  async getPermissions() {
    const { id: userId } = useRequestUser();

    const roles = await this.rolesService.findByUser(userId);

    const permissions = await this.permissionsService.findMany({
      where: {
        roles: { id: In(roles.map((role) => role.id)) },
      },
    });

    return permissions;
  }

  findAll(): Promise<User[]> {
    return this.userRepository.find({
      relations: {
        roles: true,
      },
    });
  }

  async findOne(
    criteria: FindOptionsWhere<User>,
    relations?: string[] | FindOptionsRelations<User>,
  ) {
    const user = await this.userRepository.findOne({
      where: criteria,
      relations,
    });

    if (!user) {
      throw new AuthException(AuthExceptionCode.USER_NOT_FOUND);
    }

    return user;
  }

  updateProfile(updateProfileDto: UpdateUserDto) {
    const { id: userId } = useRequestUser();

    return this.update(userId, updateProfileDto);
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const user = await this.findOne({ id });

    // 不可以更改默认管理员的用户名，删去username字段
    const defaultAdminUsername = this.configService.get(
      'DEFAULT_ADMIN_USERNAME',
    );

    if (user.username === defaultAdminUsername) {
      delete updateUserDto.username;
    }

    // 检查用户名或邮箱是否存在
    if (updateUserDto.username || updateUserDto.email) {
      const where: FindOptionsWhere<User>[] = [];

      if (updateUserDto.username) {
        where.push({ username: updateUserDto.username, id: Not(id) });
      }
      if (updateUserDto.email) {
        where.push({ email: updateUserDto.email, id: Not(id) });
      }

      if (where.length > 0) {
        const isExist = await this.userRepository.exists({ where });

        if (isExist) {
          throw new AuthException(AuthExceptionCode.USER_ALREADY_EXISTS);
        }
      }
    }

    const updatedUser = this.userRepository.merge(user, {
      ...updateUserDto,
    });

    return this.userRepository.save(updatedUser);
  }

  async updateUserSpecialRoles(
    id: string,
    { roles }: UpdateUserSpecialRolesDto,
  ) {
    // 不能修改自己的角色，除非是默认超级管理员
    const isSelf = isRequestUser(id);

    const user = await this.findOne({ id });

    const defaultAdminUsername = this.configService.get(
      'DEFAULT_ADMIN_USERNAME',
    );

    if (isSelf && user.username !== defaultAdminUsername) {
      throw new AuthException(AuthExceptionCode.SUPER_ADMIN_IS_SPECIAL);
    }

    const updatedUser = this.userRepository.merge(user, {
      specialRoles: roles,
    });

    return this.userRepository.save(updatedUser);
  }

  async updateUserRoles(id: string, { roles }: UpdateUserRolesDto) {
    const user = await this.findOne({ id });

    const newRoles = await this.rolesService.findByCodes(roles);

    const updatedUser = this.userRepository.merge(user, { roles: newRoles });

    return this.userRepository.save(updatedUser);
  }

  async updatePassword({ oldPassword, newPassword }: UpdatePasswordDto) {
    const { id } = useRequestUser();

    const user = await this.findOne({ id });

    const isPasswordValid = await verify(user.password, oldPassword);

    if (!isPasswordValid) {
      throw new AuthException(AuthExceptionCode.INVALID_CREDENTIALS);
    }

    const hashedPassword = await hash(newPassword, {
      timeCost: 5,
    });

    const isSameAsOld = await verify(user.password, newPassword);

    // 纳尼，居然新的密码不能和旧的密码相同
    if (isSameAsOld) {
      throw new AuthException(AuthExceptionCode.NEW_PASSWORD_SAME_AS_OLD);
    }

    await this.userRepository.update(id, {
      password: hashedPassword,
    });

    return new BaseResponse('Password updated successfully');
  }

  async updatePasswordByAdmin(
    id: string,
    { newPassword }: UpdatePasswordByAdminDto,
  ) {
    const user = await this.findOne({ id });

    if (!user) {
      throw new AuthException(AuthExceptionCode.USER_NOT_FOUND);
    }

    const hashedPassword = await hash(newPassword, {
      timeCost: 5,
    });

    await this.userRepository.update(id, { password: hashedPassword });

    return new BaseResponse('Password updated successfully');
  }

  async remove(id: string) {
    const user = await this.findOne({ id });

    // 如果用户是超级管理员，则不能删除
    if (user.specialRoles.includes(SpecialRolesEnum.SuperAdmin)) {
      throw new AuthException(AuthExceptionCode.SUPER_ADMIN_IS_SPECIAL);
    }

    const removedUser = await this.userRepository.softRemove(user);

    return removedUser;
  }
}
