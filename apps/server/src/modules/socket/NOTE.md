# Socket.IO + NestJS 笔记

## 核心概念

### Socket.IO 通信模型

```
Client                          Server
  |                               |
  |--- connect (HTTP Upgrade) --->|   握手阶段：先 HTTP，再升级为 WebSocket
  |<-- 101 Switching Protocols ---|
  |                               |
  |--- emit('event', data) ----->|   客户端 -> 服务端
  |<-- emit('event', data) ------|   服务端 -> 客户端
  |<-- broadcast.emit(...) -------|   服务端 -> 除发送者外的所有客户端
  |                               |
  |--- emit('event', data, cb) ->|   ACK 确认：客户端等服务端返回结果
  |<-- cb(response) -------------|
```

### 传输方式

- **WebSocket**：首选，全双工、低延迟
- **HTTP Long-Polling**：降级方案，兼容不支持 WebSocket 的环境
- 配置 `transports: ["websocket", "polling"]` 按优先级尝试

### Namespace vs Room

| 概念 | 作用 | 类比 |
|------|------|------|
| **Namespace** | 逻辑分区，隔离不同功能模块 | HTTP 的路由前缀 `/api`、`/admin` |
| **Room** | 命名频道，客户端可动态加入/离开 | 聊天室、话题订阅 |

```typescript
// Namespace：连接时指定
io('/chat')  // 客户端连接到 /chat 命名空间

// Room：运行时动态操作
client.join('room-1')    // 加入房间
client.leave('room-1')   // 离开房间
client.to('room-1').emit('msg', data)  // 发送给房间内所有人（除自己）
```

---

## NestJS WebSocket 集成

### Gateway 生命周期

```
客户端发起连接
    │
    ▼
handleConnection(client)    ← OnGatewayConnection，连接建立时触发
    │                         ⚠️ @UseGuards 对此方法不生效！
    │                         需要在此手动验证 JWT
    ▼
[客户端发送消息]
    │
    ▼
@SubscribeMessage('event')  ← 消息处理器，@UseGuards 在此处生效
    │
    ▼
handleDisconnect(client)    ← OnGatewayDisconnect，断开连接时触发
```

### 关键装饰器

```typescript
@UseGuards(WsJwtGuard)           // 方法级守卫（仅对 @SubscribeMessage 生效）
@UseFilters(WsExceptionFilter)   // 异常过滤器
@UsePipes(new ValidationPipe())  // 参数验证管道
@WebSocketGateway({ namespace: '/socket', cors: { origin: '*' } })
```

### Guard 在 WebSocket 中的特殊性

HTTP Guard 通过 `context.switchToHttp()` 获取 Request/Response。
WebSocket Guard 通过 `context.switchToWs()` 获取 Client/Message。

**重要**：`@UseGuards` 在 Gateway 级别只对 `@SubscribeMessage` 方法生效，
对 `handleConnection` / `handleDisconnect` 生命周期方法**不生效**。
因此 `handleConnection` 中需要自行验证 token。

---

## 认证流程

```
Client                          Server (Gateway)
  |                               |
  |--- connect { auth: {token}}-->|
  |                               |  handleConnection:
  |                               |    1. extractWsToken(client)
  |                               |    2. jwtService.verify(token)
  |                               |    3. usersService.findOne(id)
  |                               |    4. client.user = user
  |                               |    5. socketService.handleConnection()
  |<-- 'connected' { userId } ---|
  |                               |
  |--- emit('join-room', data)-->|
  |                               |  WsJwtGuard (自动):
  |                               |    1. extractWsToken(client)
  |                               |    2. verify + findOne
  |                               |    3. client.user = user
  |                               |  handleJoinRoom:
  |                               |    client.user 已就绪
```

### Token 提取优先级

1. `client.handshake.auth.token` — Socket.IO 推荐方式
2. `client.handshake.headers.authorization: Bearer xxx` — HTTP 兼容方式

---

## ACK 确认机制

服务端 `@SubscribeMessage` 方法的返回值会自动作为 ACK 回调的参数发送给客户端。

```typescript
// 服务端
@SubscribeMessage('send-to-room')
handleSendToRoom(...): AckResponse {
  // 处理逻辑
  return { success: true };  // 自动发送给客户端的 callback
}

// 客户端
socket.emitWithAck('send-to-room', data)
  .then(response => console.log(response))  // { success: true }
```

适合需要确认结果的场景（发送消息、写操作）。纯通知类消息不需要 ACK。

---

## 类型安全

### 事件类型定义

```typescript
// 服务端 -> 客户端的事件
interface ServerToClientEvents {
  'room-message': (data: { room: string; message: string }) => void;
  // ...
}

// 客户端 -> 服务端的事件
interface ClientToServerEvents {
  'join-room': (data: { room: string }) => void;
  // ...
}
```

### 使用方式

```typescript
// 服务端：类型化 Server
@WebSocketServer()
server!: Server<ClientToServerEvents, ServerToClientEvents>;
// this.server.emit('room-message', ...) ← 自动校验事件名和参数

// 客户端：类型化 Socket
const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(...)
// socket.on('room-message', (data) => ...) ← data 自动推导类型
// socket.emit('join-room', { room: 'x' }) ← 参数自动校验
```

---

## 多标签页 / 多设备支持

同一用户可能有多个 Socket 连接（多个标签页、多个设备）。

```typescript
// SocketService 中用 Map<userId, Set<Socket>> 存储
private connectedClients = new Map<string, Set<Socket>>();

// 发送给某个用户的所有连接
const sockets = this.socketService.getUserSockets(userId);
for (const socket of sockets) {
  socket.emit('direct-message', payload);
}
```

---

## 多实例部署

当前 `connectedClients` 存在内存中，仅支持单实例。
多实例需要使用 Redis Adapter：

```bash
npm install @socket.io/redis-adapter
```

```typescript
import { createAdapter } from '@socket.io/redis-adapter';

const io = new Server(server);
const pubClient = createClient({ url: 'redis://localhost:6379' });
const subClient = pubClient.duplicate();
io.adapter(createAdapter(pubClient, subClient));
```

---

## 常见问题

### Q: 为什么 `handleConnection` 中验证了 token，`@SubscribeMessage` 中还要 Guard？

A: `@UseGuards` 对 `handleConnection` 不生效。两者是独立的认证路径：
- `handleConnection`：连接建立时的认证（手动验证）
- `@SubscribeMessage`：每条消息的认证（Guard 自动验证）

### Q: `client.join()` 是异步的吗？

A: 是的，Socket.IO v4 中 `join()` 和 `leave()` 返回 Promise，需要 await。

### Q: 如何处理 token 过期？

A: 客户端监听 `exception` 事件，收到 401 时刷新 token 并重连：

```typescript
socket.on('exception', async (error) => {
  if (error.status === 401) {
    const newToken = await refreshToken();
    socket.auth = { token: newToken };
    socket.disconnect();
    socket.connect();
  }
});
```
