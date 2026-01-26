<script setup>
import AuthFlowChart from './components/AuthFlowChart.vue';
</script>

# 用户认证

本项目采用基于 JWT（JSON Web Token）的双 Token 机制来实现用户认证，以确保系统的安全性和良好的用户体验。

## 什么是 JWT？

JSON Web Token（JWT）是一个开放标准（RFC 7519），它定义了一种紧凑且自包含的方式，用于在各方之间安全地传输信息。由于其自包含性，JWT 可以在不访问数据库的情况下验证用户身份和权限，从而提高了系统的性能和可扩展性。

JWT 由三部分组成，使用 `.` 分隔：

1.  **Header（头部）**：包含 Token 类型（`JWT`）和所使用的签名算法（如 `HS256` 或 `RS256`）。
2.  **Payload（载荷）**：包含声明（Claims），即关于实体（通常是用户）和附加元数据的描述。
3.  **Signature（签名）**：用于验证消息在传输过程中没有被篡改。

## 双 Token 认证机制

为了兼顾安全性和用户体验，本项目采用了 Access Token 和 Refresh Token 结合的双 Token 机制。

- **Access Token**：用于访问受保护资源的凭证。它的有效期通常很短（例如 15 分钟），以降低泄露风险。每次请求 API 时，客户端都需要在请求头中携带 Access Token。
- **Refresh Token**：用于在 Access Token 过期后获取新的 Access Token。它的有效期较长（例如 7 天），并安全地存储在数据库中。

## 认证流程

<AuthFlowChart />

1.  **用户登录**：
    - 客户端发送用户名和密码到 `/auth/login` 端点。
    - 服务端验证凭证，成功后生成 Access Token 和 Refresh Token。
    - Access Token 返回给客户端，Refresh Token 存储在 HttpOnly 的 Cookie 中，以防止 XSS 攻击。

    ```typescript
    // src/modules/auth/auth.controller.ts

    @Post('login')
    async login(
      @Body() loginDto: LoginDto,
      @Res({ passthrough: true }) res: Response,
    ) {
      const tokens = await this.authService.login(loginDto);
      this.setRefreshTokenCookie(res, tokens.refreshToken);
      return {
        accessToken: tokens.accessToken,
        expiresAt: tokens.accessExpiresAt,
      };
    }
    ```

2.  **访问受保护资源**：
    - 客户端在请求头的 `Authorization` 字段中携带 Access Token（通常使用 `Bearer` 方案）。
    - 服务端的 `JwtAuthGuard` 会验证 Access Token 的有效性。如果验证通过，则允许访问。

3.  **Access Token 过期**：
    - 如果 Access Token 过期，API 请求将失败，并返回 401 Unauthorized 错误。
    - 客户端检测到 401 错误后，自动向 `/auth/refresh-token` 端点发送请求，以获取新的 Access Token。

4.  **刷新 Token**：
    - 客户端请求 `/auth/refresh-token` 时，会自动在 Cookie 中携带 Refresh Token。
    - 服务端验证 Refresh Token 的有效性（是否存在于数据库且未过期）。
    - 验证通过后，生成新的 Access Token 和 Refresh Token，并更新数据库中的记录。

    ```typescript
    // src/modules/auth/auth.controller.ts

    @Post('refresh-token')
    async refreshToken(
      @Cookies(REFRESH_TOKEN_KEY) refreshToken: string,
      @Res({ passthrough: true }) res: Response,
    ) {
      const tokens = await this.refreshTokenService.refreshToken(refreshToken);
      this.setRefreshTokenCookie(res, tokens.refreshToken);
      return {
        accessToken: tokens.accessToken,
        expiresAt: tokens.accessExpiresAt,
      };
    }
    ```

    ```typescript
    // src/modules/auth/refresh-token.service.ts

    async refreshToken(refreshToken: string) {
      const tokenRecord = await this.refreshTokenRepository.findOne({
        where: { token: refreshToken },
        relations: ['user'],
      });

      if (!tokenRecord || tokenRecord.expiresAt < new Date()) {
        // ...
        throw new ErrorException(ErrorExceptionCode.INVALID_REFRESH_TOKEN);
      }

      const tokens = this.generateTokens(tokenRecord.user);

      await this.refreshTokenRepository.update(tokenRecord.id, {
        token: tokens.refreshToken,
        expiresAt: tokens.refreshExpiresAt,
      });

      return tokens;
    }
    ```

5.  **用户登出**：
    - 客户端请求 `/auth/logout` 端点。
    - 服务端从数据库中删除对应的 Refresh Token，并清除客户端的 Cookie。

    ```typescript
    // src/modules/auth/auth.controller.ts

    @Post('logout')
    logout(
      @Cookies(REFRESH_TOKEN_KEY) refreshToken: string,
      @Res({ passthrough: true }) res: Response,
    ) {
      res.clearCookie(REFRESH_TOKEN_KEY);
      return this.authService.logout(refreshToken);
    }
    ```

## 核心代码实现

### Token 生成

`RefreshTokenService` 中的 `generateTokens` 方法负责生成 Access Token 和 Refresh Token。

```typescript
// src/modules/auth/refresh-token.service.ts

generateTokens(user: User) {
  const payload: JwtPayload = {
    sub: user.id,
    type: TokenType.ACCESS,
  };

  const accessToken = this.jwtService.sign(payload);
  const refreshToken = this.jwtService.sign(
    { ...payload, type: TokenType.REFRESH },
    {
      expiresIn: getConfig(this.configService).jwt.refreshExpiresIn,
    },
  );
  // ...
  return { accessToken, refreshToken, accessExpiresAt, refreshExpiresAt };
}
```

### JWT 验证策略

`JwtAuthStrategy` 负责验证 Access Token 的有效性，并从 Token 中提取用户信息。

```typescript
// src/modules/auth/strategies/jwt-auth.strategy.ts

@Injectable()
export class JwtAuthStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: getConfig(configService).jwt.secret,
    });
  }

  async validate(payload: JwtPayload) {
    if (payload.type !== TokenType.ACCESS) {
      throw new ErrorException(ErrorExceptionCode.INVALID_TOKEN);
    }
    const user = await this.usersService.findOne({ id: payload.sub });
    if (!user) {
      throw new ErrorException(ErrorExceptionCode.USER_NOT_FOUND);
    }
    return user;
  }
}
```

通过这种方式，我们构建了一个安全、可靠且易于维护的用户认证系统。
