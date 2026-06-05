import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { initSnowflake, resetSnowflake } from '@/shared/utils/snowflake';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '@/app.module';
import { appUse } from '@/common/use';
import seed from '../../../database/seeds';

export class TestHelper {
  app!: INestApplication;
  dataSource!: DataSource;
  private initialized = false;

  async init() {
    if (this.initialized) return this;

    // 确保环境变量存在
    process.env.DATABASE_URL =
      process.env.DATABASE_URL || 'postgresql://postgres@localhost/first-nest';
    // 不设置 REDIS_URL，使用内存缓存

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(CACHE_MANAGER)
      .useFactory({
        factory: () => {
          // 创建一个简单的内存缓存，绕过 Keyv 构造函数的问题
          const store = new Map<string, unknown>();
          return {
            get: async (key: string) => store.get(key),
            set: async (key: string, value: unknown) => {
              store.set(key, value);
              return value;
            },
            del: async (key: string) => store.delete(key),
            mdel: async (keys: string[]) => {
              keys.forEach((k) => store.delete(k));
              return true;
            },
            wrap: async (key: string, fn: () => Promise<unknown>) => {
              if (store.has(key)) return store.get(key);
              const value = await fn();
              store.set(key, value);
              return value;
            },
            stores: [],
          };
        },
      })
      .compile();

    this.app = moduleFixture.createNestApplication();
    this.app.setGlobalPrefix('api');
    appUse(this.app);

    await this.app.init();

    this.dataSource = moduleFixture.get(DataSource);

    // 初始化雪花ID
    initSnowflake(0n, 0n);
    this.initialized = true;

    return this;
  }

  async close() {
    if (!this.initialized) return;
    resetSnowflake();
    await this.app.close();
    this.initialized = false;
  }

  getHttpServer() {
    return this.app.getHttpServer();
  }

  /**
   * 清理指定表的数据（按依赖顺序）
   */
  async cleanDatabase() {
    const entities = this.dataSource.entityMetadatas;

    // 使用 TRUNCATE ... CASCADE 绕过外键约束
    const tableNames = entities.map((e) => `"${e.tableName}"`).join(', ');
    if (tableNames) {
      await this.dataSource.query(`TRUNCATE TABLE ${tableNames} CASCADE`);
    }
  }

  /**
   * 初始化种子数据（权限、角色等）
   */
  async seedDatabase() {
    await seed(this.dataSource);
  }

  /**
   * 注册用户并返回登录后的 token
   */
  async signupAndLogin(user: {
    username: string;
    email: string;
    password: string;
    nickname?: string;
    roles?: string[];
  }) {
    // 注册
    await request(this.getHttpServer())
      .post('/api/auth/signup')
      .send(user)
      .expect(200);

    // 登录
    const loginRes = await request(this.getHttpServer())
      .post('/api/auth/login')
      .send({ username: user.username, password: user.password })
      .expect(200);

    return {
      accessToken: loginRes.body.accessToken as string,
      refreshToken: this.extractRefreshToken(loginRes),
    };
  }

  /**
   * 从 Set-Cookie 中提取 refreshToken
   */
  private extractRefreshToken(res: request.Response): string {
    const cookies = res.headers['set-cookie'] as string[] | undefined;
    if (!cookies) return '';

    const rtCookie = cookies.find((c) => c.startsWith('refreshToken='));
    if (!rtCookie) return '';

    const match = rtCookie.match(/refreshToken=([^;]+)/);
    return match ? match[1] : '';
  }
}
