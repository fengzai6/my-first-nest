import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    return validateRequest(request);
  }
}

function validateRequest(
  request: any,
): boolean | Promise<boolean> | Observable<boolean> {
  // console.log('request:', request);

  const user = request.user;

  console.log('user:', user.username);

  // request.user = {
  //   id: 1,
  //   name: 'admin',
  //   roles: ['admin'],
  // };

  return true;

  throw new Error('Function not implemented.');
}
