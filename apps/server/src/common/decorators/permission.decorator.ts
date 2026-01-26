import { Reflector } from '@nestjs/core';
import { PermissionCodeType } from '../constants/permissions';

export const Permission = Reflector.createDecorator<PermissionCodeType>();
