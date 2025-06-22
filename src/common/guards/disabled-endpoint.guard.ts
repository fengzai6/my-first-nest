import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

@Injectable()
export class DisabledEndpointGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    throw new ForbiddenException('此接口已被禁用或正在开发中，暂时无法使用');
  }
}
