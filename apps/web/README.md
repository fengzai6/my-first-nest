# 项目前端

本项目是 `my-first-nest` 的前端部分，基于 React, TypeScript 和 Vite 构建。

## 功能

- 用户认证 (登录、注册)
- (根据你的项目添加更多功能)

## 技术栈

- **框架**: [React](https://react.dev/)
- **构建工具**: [Vite](https://vitejs.dev/)
- **UI 库**: [Ant Design](https://ant.design/) & [shadcn/ui](https://ui.shadcn.com/) (通过 `lucide-react`, `class-variance-authority`, etc. 实现)
- **路由**: [React Router](https://reactrouter.com/)
- **状态管理**: [Zustand](https://zustand-demo.pmnd.rs/)
- **表单处理**: [React Hook Form](https://react-hook-form.com/) & [Zod](https://zod.dev/)
- **HTTP 请求**: [Axios](https://axios-http.com/)
- **样式**: [Tailwind CSS](https://tailwindcss.com/)

## 快速开始

### 环境要求

请确保你的开发环境已经安装了 [Node.js](https://nodejs.org/) (建议版本 >= 20.19.3).

### 安装依赖

进入 `client` 目录，然后运行以下命令安装项目所需的依赖：

```bash
yarn
```

### 运行开发服务器

安装完依赖后，可以通过以下命令来启动本地开发服务器：

```bash
yarn dev
```

## 目录结构

```
client/
├── public/          # 静态资源
├── src/
│   ├── assets/        # 图片等资源文件
│   ├── components/    # 可复用UI组件
│   ├── constants/     # 常量
│   ├── lib/           # 工具函数
│   ├── pages/         # 页面组件
│   ├── router/        # 路由配置
│   ├── services/      # API请求和数据服务
│   ├── stores/        # Zustand 状态管理
│   ├── app.tsx        # 应用根组件
│   └── main.tsx       # 应用入口文件
└── package.json
```
