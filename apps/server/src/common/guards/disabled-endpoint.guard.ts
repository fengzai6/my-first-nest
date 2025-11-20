import { CanActivate, Injectable } from '@nestjs/common';
import { DisabledEndpointException } from '../exceptions/disabled-endpoint.exception';

@Injectable()
export class DisabledEndpointGuard implements CanActivate {
  canActivate(): boolean {
    throw new DisabledEndpointException();
  }
}
