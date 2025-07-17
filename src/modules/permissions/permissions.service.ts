import { PermissionCodeType } from '@/common/constants';
import {
  ErrorException,
  ErrorExceptionCode,
} from '@/common/exceptions/error.exception';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindManyOptions, In, Repository } from 'typeorm';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { Permission } from './entities';

@Injectable()
export class PermissionsService {
  constructor(
    @InjectRepository(Permission)
    private readonly permissionRepository: Repository<Permission>,
  ) {}

  create(createPermissionDto: CreatePermissionDto) {
    const permission = this.permissionRepository.create(createPermissionDto);

    return this.permissionRepository.save(permission);
  }

  findByCodes(codes: PermissionCodeType[]) {
    return this.permissionRepository.find({
      where: {
        code: In(codes),
      },
    });
  }

  findAll() {
    return this.permissionRepository.find();
  }

  findMany(criteria: FindManyOptions<Permission>) {
    return this.permissionRepository.find(criteria);
  }

  findOne(id: string) {
    return this.permissionRepository.findOneBy({ id });
  }

  async update(id: string, updatePermissionDto: UpdatePermissionDto) {
    const permission = await this.permissionRepository.findOneBy({ id });

    if (!permission) {
      throw new ErrorException(ErrorExceptionCode.PERMISSION_NOT_FOUND);
    }

    const updatedPermission = this.permissionRepository.merge(
      permission,
      updatePermissionDto,
    );

    return this.permissionRepository.save(updatedPermission);
  }

  async remove(id: string) {
    const permission = await this.permissionRepository.findOneBy({ id });

    if (!permission) {
      throw new ErrorException(ErrorExceptionCode.PERMISSION_NOT_FOUND);
    }

    return this.permissionRepository.softDelete(id);
  }
}
