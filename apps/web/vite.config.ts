import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";
import { compression } from "vite-plugin-compression2";

// https://vite.dev/config/
export default defineConfig(() => {
  return {
    plugins: [
      react({
        babel: {
          plugins: ["babel-plugin-react-compiler"],
        },
      }),
      // pnpm 在这里有 bug 导致报错，所以设置为 any
      tailwindcss() as any,
      // 构建时预压缩为 .gz 文件，nginx 直接返回无需运行时压缩
      compression({ algorithms: ["gzip"] }),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      proxy: {
        "/api": {
          target: `http://localhost:8080`,
          changeOrigin: true,
        },
        "/socket.io": {
          target: `http://localhost:8080`,
          changeOrigin: true,
          ws: true,
        },
      },
    },
  };
});
