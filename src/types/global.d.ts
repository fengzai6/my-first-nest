declare global {
  namespace NodeJS {
    interface ProcessEnv {
      PORT: number;
      DATABASE_HOST: string;
      DATABASE_PORT: number;
      DATABASE_USERNAME: string;
      DATABASE_PASSWORD: string;
      DATABASE_NAME: string;
      DATABASE_URL: string;
      DATABASE_SYNCHRONIZE: boolean;
      DEFAULT_ADMIN_USERNAME: string;
      DEFAULT_ADMIN_PASSWORD: string;
      JWT_SECRET: string;
      JWT_EXPIRES_IN: string;
      SWAGGER_OPEN: boolean;
      WORKER_ID: number;
      DATACENTER_ID: number;
    }
  }
}

export {};
