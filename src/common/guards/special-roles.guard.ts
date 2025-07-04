import { matchRoles } from '@/shared/utils';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SpecialRoles } from '../decorators/special-roles.decorator';

@Injectable()
export class SpecialRolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get(
      SpecialRoles,
      context.getHandler(),
    );

    console.log('requiredSpecialRoles:', requiredRoles);

    if (!requiredRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest();

    const user = request.user;

    if (!user || !user.specialRoles) {
      return false;
    }

    return matchRoles(requiredRoles, user.specialRoles);
  }
}
