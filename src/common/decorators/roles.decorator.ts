import { Reflector } from '@nestjs/core';

export enum RolesEnum {
  Admin = 'admin',
  User = 'user',
  Developer = 'developer',
}

export const Roles = Reflector.createDecorator<RolesEnum[]>();

// import { SetMetadata } from '@nestjs/common';

// export const Roles = (...roles: string[]) => SetMetadata('roles', roles);
