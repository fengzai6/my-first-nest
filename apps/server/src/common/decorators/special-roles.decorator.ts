import { Reflector } from '@nestjs/core';

export enum SpecialRolesEnum {
  /**
   * 超级管理员, 拥有所有权限（指 Permissions）
   */
  SuperAdmin = 'super_admin',
  /**
   * 开发者, 可以用于调用如：系统日志、系统监控等接口
   */
  Developer = 'developer',
}

export const SpecialRoles = Reflector.createDecorator<SpecialRolesEnum[]>();

// import { SetMetadata } from '@nestjs/common';

// export const Roles = (...roles: string[]) => SetMetadata('roles', roles);
