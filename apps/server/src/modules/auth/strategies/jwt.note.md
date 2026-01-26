# Jwt

JWT 是 JSON Web Tokens 的缩写，是目前最流行的跨域认证解决方案，是一个开放式标准(RFC 7519)，用于在各方之间以 JSON 对象安全传输信息。

## Payload

JWT 的 Payload 是 JWT 的第二部分，它包含了一些用户信息，例如用户 ID、用户名、过期时间等。
tip: 这个信息是公开的，可以被任何人读取。

一般 Payload 包含以下字段：

- `iss` (Issuer): 签发者
- `sub` (Subject): 主题
- `aud` (Audience): 接收者
- `exp` (Expiration Time): 过期时间
- `nbf` (Not Before): 生效时间
- `iat` (Issued At): 签发时间
- `jti` (JWT ID): 唯一标识

## 对称密钥加密

对称密钥加密（Symmetric Key Encryption）是指加密和解密都使用同一个密钥。JWT 默认支持 HMAC-SHA（如 HS256、HS384、HS512）等对称加密算法。

### 原理

- 发送方和接收方都持有同一份密钥。
- 发送方用密钥对数据进行签名，接收方用同样的密钥验证签名。
- 只要密钥不泄露，数据的完整性和真实性就能得到保证。
