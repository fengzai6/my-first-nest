import {
  ErrorException,
  ErrorExceptionCode,
} from '@/common/exceptions/error.exception';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Permission } from '../permissions/entities';
import { PermissionsService } from '../permissions/permissions.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { Role } from './entities';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    private readonly permissionsService: PermissionsService,
  ) {}

  async create(createRoleDto: CreateRoleDto) {
    const permissions = await this.permissionsService.findByCodes(
      createRoleDto.permissions,
    );

    const role = this.roleRepository.create({
      ...createRoleDto,
      permissions,
    });

    return this.roleRepository.save(role);
  }

  findByCodes(codes: string[]) {
    return this.roleRepository.find({
      where: { code: In(codes) },
    });
  }

  findByUser(userId: string) {
    return this.roleRepository.find({
      where: { users: { id: userId } },
    });
  }

  findAll() {
    return this.roleRepository.find({
      relations: {
        permissions: true,
      },
    });
  }

  findOne(id: string) {
    return this.roleRepository.findOne({
      where: { id },
      relations: {
        permissions: true,
      },
    });
  }

  async update(id: string, updateRoleDto: UpdateRoleDto) {
    const role = await this.roleRepository.findOne({
      where: { id },
    });

    if (!role) {
      throw new ErrorException(ErrorExceptionCode.ROLE_NOT_FOUND);
    }

    let permissions: Permission[] = role.permissions;

    if (updateRoleDto.permissions) {
      permissions = await this.permissionsService.findByCodes(
        updateRoleDto.permissions,
      );
    }

    const updatedRole = this.roleRepository.merge(role, {
      ...updateRoleDto,
      permissions,
    });

    return this.roleRepository.save(updatedRole);
  }

  async remove(id: string) {
    const role = await this.roleRepository.findOne({
      where: { id },
    });

    if (!role) {
      throw new ErrorException(ErrorExceptionCode.ROLE_NOT_FOUND);
    }

    return this.roleRepository.softDelete(id);
  }

  async getRolesByUserId(userId: string) {
    const roles = await this.roleRepository.find({
      where: { users: { id: userId } },
    });

    return roles;
  }
}
