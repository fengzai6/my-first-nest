# HttpStatus 状态码

```ts
export declare enum HttpStatus {
  CONTINUE = 100, // 继续
  SWITCHING_PROTOCOLS = 101, // 切换协议
  PROCESSING = 102, // 处理中
  EARLYHINTS = 103, // 早期提示
  OK = 200, // 成功
  CREATED = 201, // 已创建
  ACCEPTED = 202, // 已接受
  NON_AUTHORITATIVE_INFORMATION = 203, // 非权威信息
  NO_CONTENT = 204, // 无内容
  RESET_CONTENT = 205, // 重置内容
  PARTIAL_CONTENT = 206, // 部分内容
  AMBIGUOUS = 300, // 多重选择
  MOVED_PERMANENTLY = 301, // 永久重定向
  FOUND = 302, // 临时重定向
  SEE_OTHER = 303, // 查看其他
  NOT_MODIFIED = 304, // 未修改
  TEMPORARY_REDIRECT = 307, // 临时重定向
  PERMANENT_REDIRECT = 308, // 永久重定向
  BAD_REQUEST = 400, // 错误请求
  UNAUTHORIZED = 401, // 未授权
  PAYMENT_REQUIRED = 402, // 需要付费
  FORBIDDEN = 403, // 禁止访问
  NOT_FOUND = 404, // 未找到
  METHOD_NOT_ALLOWED = 405, // 方法不允许
  NOT_ACCEPTABLE = 406, // 不可接受
  PROXY_AUTHENTICATION_REQUIRED = 407, // 代理认证需要
  REQUEST_TIMEOUT = 408, // 请求超时
  CONFLICT = 409, // 冲突
  GONE = 410, // 已经消失
  LENGTH_REQUIRED = 411, // 需要长度
  PRECONDITION_FAILED = 412, // 前提条件失败
  PAYLOAD_TOO_LARGE = 413, // 负载太大
  URI_TOO_LONG = 414, // URI 太长
  UNSUPPORTED_MEDIA_TYPE = 415, // 不支持的媒体类型
  REQUESTED_RANGE_NOT_SATISFIABLE = 416, // 请求范围不可满足
  EXPECTATION_FAILED = 417, // 期望失败
  I_AM_A_TEAPOT = 418, // 我是一个茶壶
  MISDIRECTED = 421, // 误导
  UNPROCESSABLE_ENTITY = 422, // 不可处理实体
  FAILED_DEPENDENCY = 424, // 依赖失败
  PRECONDITION_REQUIRED = 428, // 需要前提条件
  TOO_MANY_REQUESTS = 429, // 请求过多
  INTERNAL_SERVER_ERROR = 500, // 内部服务器错误
  NOT_IMPLEMENTED = 501, // 未实现
  BAD_GATEWAY = 502, // 错误网关
  SERVICE_UNAVAILABLE = 503, // 服务不可用
  GATEWAY_TIMEOUT = 504, // 网关超时
  HTTP_VERSION_NOT_SUPPORTED = 505, // HTTP 版本不支持
}
```
