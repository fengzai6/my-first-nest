import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { Permission } from '../decorators/permission.decorator';
import {
  SpecialRoles,
  SpecialRolesEnum,
} from '../decorators/special-roles.decorator';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermission = this.reflector.get(
      Permission,
      context.getHandler(),
    );

    if (!requiredPermission) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();

    const user = request.user;

    // 超级管理员拥有所有权限, 使用可选链模式避免报错
    if (user?.specialRoles?.includes(SpecialRolesEnum.SuperAdmin)) {
      return true;
    }

    if (!user || !user.roles) {
      return false;
    }

    const roles = user.roles;

    const permissions = roles.map((role) => role.permissions).flat();

    return permissions.some(
      (permission) => permission.code === requiredPermission,
    );
  }
}
