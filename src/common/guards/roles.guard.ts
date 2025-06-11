import { matchRoles } from '@/shared/utils';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Roles } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get(Roles, context.getHandler());

    console.log('requiredRoles:', requiredRoles);

    if (!requiredRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest();

    const user = request.user;

    if (!user || !user.roles) {
      return false;
    }

    return matchRoles(requiredRoles, user.roles);
  }

  // 处理相关的 Exception
}
