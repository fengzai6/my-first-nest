---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: 'My Fires Nest'
  text: '一个全栈 NestJs 项目'
  tagline: 希望作为一个优秀的实践项目，为我也为你
  actions:
    - theme: brand
      text: 开始使用
      link: /guide/intro
    - theme: alt
      text: 开发笔记
      link: /notes/intro

features:
  - title: 🏗️ 企业级项目架构
    details: 严格遵循 NestJS 最佳实践，模块化设计，清晰的目录结构，完善的 TypeScript 类型检查，ESLint + Prettier 代码规范，Husky + Commitlint 提交检查
  - title: 🔐 完整的认证授权系统
    details: 基于 JWT 的双 Token 认证（AccessToken + RefreshToken），RBAC 权限管理，用户角色权限分离，支持群组管理，安全可靠的身份验证机制
  - title: 🗄️ 强大的数据库管理
    details: TypeORM + PostgreSQL 组合，支持数据库迁移、种子数据填充、审计字段自动记录，雪花算法 ID 生成器，完整的 CRUD 操作示例
  - title: 📚 完善的开发工具链
    details: Swagger API 文档自动生成，环境配置验证，全局异常处理，统一响应格式，日志记录，拦截器与守卫机制
  - title: 🎨 现代化前端展示
    details: React + Vite + TypeScript 技术栈，TailwindCSS + ShadcnUI 组件库，响应式设计，与后端 API 完美对接
  - title: 🚀 开箱即用的开发体验
    details: 详细的代码注释和学习笔记，完整的项目文档，Docker 容器化支持，一键启动脚本，适合学习和生产环境
---
