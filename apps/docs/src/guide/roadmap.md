# 项目路线图

## 已完成功能 ✅

- [x] 基础项目结构搭建
- [x] Swagger API 文档集成
- [x] TypeORM 数据库集成
- [x] 用户账号系统
- [x] 用户群组结构管理
- [x] JWT 认证与授权
- [x] 双 token 认证：AccessToken 和 RefreshToken
- [x] 数据库初始化和相关迁移工具
  - [x] migration 生成工具
  - [x] 数据库初始化脚本
  - [x] 数据库种子脚本
- [x] 日志系统
  - [x] 异步批量落库
  - [x] 可选的 Seq CLEF 投递
- [x] 文件上传与附件管理
  - [x] 通用上传和私有附件签名 URL
  - [x] 头像和资料文档附件绑定
  - [x] 附件物理清理任务
- [x] 资料文档模块
- [x] 后台任务中心
  - [x] BullMQ 任务队列、重试与任务记录
  - [x] 任务状态 SSE 订阅
  - [x] Bull Board 管理界面
- [ ] RBAC 权限管理
  - [x] 核心 RBAC0：用户、角色、权限
  - [ ] 分级 RBAC1：角色继承，角色可以继承下级角色的权限
  - [ ] 约束 RBAC2：权限约束，强制职责分离，某些任务要求两个或多个角色共同完成
  - [ ] 对称 RBAC3：1 + 2, 并且可以获取组织拥有的权限，继承 Group，离开 Group 后，权限消失
- [x] 雪花算法作为 ID 生成器
- [x] 使用 joi 进行数据验证（环境变量）
- [x] WebSocket 实时通信
  - [x] NestJS WebSocket Gateway + Socket.IO
  - [x] JWT 鉴权守卫（WsJwtGuard）
  - [x] 房间管理（join/leave）
  - [x] 点对点消息、广播
  - [x] ACK 确认机制 + DTO 输入验证
  - [x] 全链路 TypeScript 事件类型约束
  - [x] React Hook 封装（useSocket）
- [x] 添加客户端来展示项目功能
  - [x] 使用 React & Vite & TailwindCSS & Antd 制作客户端
- [x] Redis 缓存集成
- [x] 接口限流
- [x] Docker 容器化部署
- [x] GitHub Actions CI
- [x] 定时任务系统（@nestjs/schedule 轻量定时任务 + BullMQ 任务中心）
- [x] 单元测试与 E2E 测试
- [x] 项目文档站点

## 计划功能 📋

- [ ] session 管理
- [ ] 国际化支持，统一管理响应信息，并根据用户语言返回不同的多语言
- [ ] 对外接口 API Key 认证与管理（创建、撤销、哈希存储、scope、过期、Guard）
- [ ] 第三方登录集成：GitHub等
- [ ] GitHub Actions 自动化部署
  - [ ] 部署文档页面
