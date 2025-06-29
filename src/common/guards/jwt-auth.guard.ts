import { User } from '@/modules/users/entities/user.entity';
import {
  ExecutionContext,
  HttpException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import { JWT_META_KEY, JwtMetaEnum } from '../decorators/jwt-auth.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const jwtMeta = this.reflector.get(JWT_META_KEY, context.getHandler());

    if (jwtMeta === JwtMetaEnum.PUBLIC) {
      return true;
    }

    return super.canActivate(context);
  }

  handleRequest<TUser = User>(
    err: any,
    user: User | undefined,
    info: any,
    context: ExecutionContext,
    status?: any,
  ): TUser {
    console.log('-------------JwtAuthGuard-------------');
    console.log('err:', err);
    console.log('user:', user?.username);
    console.log('info:', info);
    console.log('--------------------------------------');

    if (err) {
      throw err;
    }

    if (info instanceof Error) {
      throw new UnauthorizedException(info.message);
    }

    return user as TUser;
  }
}
