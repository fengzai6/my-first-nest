import { userContextStorage } from '@/common/context/user-context';
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable } from 'rxjs';

/**
 * 将用户信息存储到上下文，拦截器会晚于 jwt 守卫执行，所以可以获取到用户信息
 * 由于 AsyncLocalStorage.run() 方法需要一个回调函数，它会为这个回调函数内的所有异步操作创建一个上下文
 * 拦截器的 next.handle() 就是这个完美的回调函数
 * 守卫的 canActivate 方法并没有提供这样一个“包裹后续所有操作”的回调函数
 * 所以需要使用拦截器来实现
 */
@Injectable()
export class UserContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();

    return userContextStorage.run(request.user, () => next.handle());
  }
}
