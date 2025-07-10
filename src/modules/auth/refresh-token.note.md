### Refresh Token 和 Cookie

`RefreshToken` (刷新令牌) 是一种用于获取新 `AccessToken` (访问令牌) 的凭证。与 `AccessToken` 相比，`RefreshToken` 通常具有更长的有效期。
这样`AccessToken` 的过期时间一般设置为短期内过期，从而保护用户 Token 泄露后减免滥用的风险。

#### 为什么使用 Cookie 存储 RefreshToken？

为了提高安全性，`RefreshToken` 通常不应由客户端（例如浏览器中的 JavaScript）直接管理。将其存储在 `localStorage` 或 `sessionStorage` 中会使其容易受到跨站脚本（XSS）攻击。如果攻击者能够注入并执行恶意脚本，他们就可以读取并窃取存储中的 `RefreshToken`。

将 `RefreshToken` 存储在 `HttpOnly` cookie 中是更安全的选择。这样可以防止客户端脚本访问该令牌，从而大大降低 XSS 攻击的风险。

#### Cookie 的安全属性

在设置包含 `RefreshToken` 的 cookie 时，应配置以下属性以增强安全性：

1.  **`HttpOnly`**
    - **作用**：禁止通过 JavaScript 的 `document.cookie` API 访问 cookie。这是防止 XSS 攻击窃取令牌的关键措施。设置此属性后，该 cookie 只能由服务器读取。

2.  **`Secure`**
    - **作用**：确保浏览器仅在通过 HTTPS 协议发起的请求中才发送该 cookie。这可以防止在不安全的 HTTP 连接上发生中间人攻击，从而避免令牌被窃听。在生产环境中，此属性应始终启用。

3.  **`SameSite`**
    - **作用**：控制浏览器如何处理跨站请求中的 cookie。这是防御跨站请求伪造（CSRF）攻击的重要机制。它有三个可能的值：
      - **`Strict`**：最严格的策略。浏览器完全不会在任何跨站请求中发送 cookie，即使是用户从其他站点点击链接导航过来。
      - **`Lax`** (推荐的默认值)：在大多数情况下提供良好的平衡。它允许在顶层导航（如点击链接）时发送 cookie，但在通过 `POST` 方法、`iframe` 或 `AJAX` 发起的跨站请求中会阻止 cookie 的发送。
      - **`None`**：允许在所有跨站请求中发送 cookie。如果使用此设置，则必须同时设置 `Secure` 属性。这通常用于需要跨域身份验证的 API 或服务。

4.  **`Path`**
    - **作用**：指定一个 URL 路径，只有当请求的路径与此路径匹配或为其子路径时，浏览器才会发送该 cookie。例如，如果 `Path=/api`，那么只有向 `/api/...` 发出的请求才会携带此 cookie。这有助于限制 cookie 的发送范围，减少不必要的暴露。

5.  **`Expires` / `Max-Age`**
    - **作用**：设置 cookie 的生命周期。
      - `Expires`：指定一个具体的过期日期和时间。
      - `Max-Age`：指定从现在开始的秒数，经过该时间后 cookie 将过期。`Max-Age` 的优先级高于 `Expires`。
    - 为 `RefreshToken` 设置合理的有效期非常重要，以平衡用户体验和安全风险。

#### 示例

一个安全的 `RefreshToken` cookie 设置可能如下所示：

```
Set-Cookie: refreshToken=...; HttpOnly; Secure; SameSite=Lax; Path=/api/auth/refresh; Max-Age=2592000
```

这个设置确保了 `RefreshToken`：

- 不能被客户端脚本读取。
- 仅通过 HTTPS 发送。
- 在大多数跨站请求中被阻止。
- 仅在请求 `/api/auth/refresh` 路径时发送。
- 有效期为 30 天 (2592000秒)。
