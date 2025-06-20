import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
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

  findAll() {
    return this.roleRepository.find();
  }

  findOne(id: number) {
    return this.roleRepository.findOne({
      where: { id },
    });
  }

  async update(id: number, updateRoleDto: UpdateRoleDto) {
    const role = await this.roleRepository.findOne({
      where: { id },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    const permissions = await this.permissionsService.findByCodes(
      updateRoleDto.permissions,
    );

    const updatedRole = this.roleRepository.merge(role, {
      ...updateRoleDto,
      permissions,
    });

    return this.roleRepository.save(updatedRole);
  }

  async remove(id: number) {
    const role = await this.roleRepository.findOne({
      where: { id },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    return this.roleRepository.softDelete(id);
  }
}
