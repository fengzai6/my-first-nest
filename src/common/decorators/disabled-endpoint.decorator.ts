import { UseGuards, applyDecorators } from '@nestjs/common';
import { DisabledEndpointGuard } from '../guards/disabled-endpoint.guard';

/**
 * 禁用接口装饰器
 *
 * 用于标记那些禁用或正在开发中的接口
 * 当用户访问被此装饰器标记的接口时，将返回403错误
 */
export const DisabledEndpoint = () => {
  return applyDecorators(UseGuards(DisabledEndpointGuard));
};
