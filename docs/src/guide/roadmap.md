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
- [ ] RBAC 权限管理
  - [x] 核心 RBAC0：用户、角色、权限
  - [ ] 分级 RBAC1：角色继承，角色可以继承下级角色的权限
  - [ ] 约束 RBAC2：权限约束，强制职责分离，某些任务要求两个或多个角色共同完成
  - [ ] 对称 RBAC3：1 + 2, 并且可以获取组织拥有的权限，继承 Group，离开 Group 后，权限消失
- [x] 雪花算法作为 ID 生成器
- [x] 使用 joi 进行数据验证（环境变量）
- [ ] 添加客户端来展示项目功能
  - [ ] 使用 React & React Router & Vite & TailwindCSS & ShadcnUI & Antd 制作客户端

## 计划功能 📋

- [ ] Redis 缓存集成
- [ ] session 管理
- [ ] 日志系统实现
- [ ] 文件上传功能
- [ ] 定时任务系统
- [ ] 单元测试与 E2E 测试
- [ ] Docker 容器化部署
- [ ] 国际化支持，统一管理响应信息，并根据用户语言返回不同的多语言
- [ ] 接口限流（全局或者指定配置）
- [ ] 第三方登录集成：GitHub等
- [ ] WebSocket 实时通信
- [ ] sse 实时通信
- [ ] 使用文档制作
  - [ ] 使用 Vitepress/Docusaurus 制作项目文档
- [ ] github action 自动化部署
  - [ ] 部署文档页面
