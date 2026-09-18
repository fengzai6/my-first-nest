import { Permission } from '@/common/decorators/permission.decorator';
import { SpecialRolesEnum } from '@/common/decorators/special-roles.decorator';
import { PermissionsService } from '@/modules/permissions/permissions.service';
import type { User } from '@/modules/users/entities/user.entity';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

@Injectable()
export class AttachmentsManagementPermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionsService: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermission = this.reflector.get(
      Permission,
      context.getHandler(),
    );

    if (!requiredPermission) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user: User | undefined = request.user;

    if (user?.specialRoles?.includes(SpecialRolesEnum.SuperAdmin)) {
      return true;
    }
    if (!user) {
      return false;
    }

    return this.permissionsService.hasUserPermission(
      user.id,
      requiredPermission,
    );
  }
}
