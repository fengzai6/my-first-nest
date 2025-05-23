import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Roles } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.get(Roles, context.getHandler());

    console.log('roles:', roles);

    if (!roles) {
      return true;
    }

    const request = context.switchToHttp().getRequest();

    const user = request.user;

    console.log('user:', user);

    if (!user) {
      return false;
    }

    return matchRoles(roles, user.roles);
  }
}

function matchRoles(roles: string[], userRoles: string[]): boolean {
  return roles.some((role) => userRoles.includes(role));
}
