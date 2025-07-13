import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { defineConfig, loadEnv } from "vite";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // 从项目根目录加载 .env 文件
  const env = loadEnv(mode, path.resolve(__dirname, ".."), "");

  const SERVER_PORT = env.PORT || 3000;

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      proxy: {
        "/api": {
          target: `http://localhost:${SERVER_PORT}`,
          changeOrigin: true,
        },
      },
    },
  };
});
