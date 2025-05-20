declare global {
  namespace NodeJS {
    interface ProcessEnv {
      PORT: number;
      DATABASE_TYPE: string;
      DATABASE_URL: string;
      DATABASE_SYNCHRONIZE: boolean;
      JWT_SECRET: string;
      JWT_EXPIRES_IN: string;
    }
  }
}

export {};
