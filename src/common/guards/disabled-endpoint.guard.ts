import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { DisabledEndpointException } from '../exceptions/disabled-endpoint.exception';

@Injectable()
export class DisabledEndpointGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    throw new DisabledEndpointException();
  }
}
