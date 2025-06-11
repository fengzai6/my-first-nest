import { matchRoles } from '@/shared/utils';
import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GroupMemberRoles } from '../decorators/group-member-roles';

// 不太对劲。。。
// export class GroupMemberRolesGuard implements CanActivate {
//   constructor(private reflector: Reflector) {}

//   canActivate(context: ExecutionContext): boolean {
//     const roles = this.reflector.get(GroupMemberRoles, context.getHandler());

//     if (!roles) {
//       return true;
//     }

//     const request = context.switchToHttp().getRequest();

//     const user = request.user;

//     if (!user || !user.roles) {
//       return false;
//     }

//     return matchRoles(roles, user.roles);
//   }
// }
