# BullMQ 任务队列

> 用 BullMQ + Redis 实现异步任务处理。

## 1. 为什么需要任务队列

有些操作不适合在请求链路中同步执行：

- **发邮件**：用户注册后发欢迎邮件，不应该等邮件发完才返回响应
- **图片处理**：上传头像后生成缩略图，耗时几秒，同步等待体验差
- **数据同步**：用户更新信息后同步到 ES / 第三方服务
- **定时任务**：延迟执行、定时执行、失败重试

任务队列的模式：

```
生产者（API 请求）→ 队列（Redis）→ 消费者（Worker 进程）
```

API 只负责把任务丢进队列，立即返回。Worker 在后台消费任务。

## 2. 为什么选 BullMQ

| 方案 | 说明 |
| --- | --- |
| BullMQ | 最成熟的 Node.js 任务队列，基于 Redis Streams，支持延迟任务、重试、优先级、并发控制 |
| Bull | BullMQ 的前身，已停止维护 |
| Agenda | 基于 MongoDB，适合已有 MongoDB 的项目 |
| 自己用 Redis List | 简单场景可以，但没有重试、延迟、监控等能力 |

BullMQ 优势：

- 延迟任务（`delay`）
- 失败自动重试（`attempts` + `backoff`）
- 优先级队列
- 并发控制（`concurrency`）
- 速率限制（`rateLimiter`）
- 可视化监控（Bull Board）
- NestJS 官方集成（`@nestjs/bullmq`）

## 3. 安装与配置

### 3.1 安装依赖

```bash
yarn workspace @my-first-nest/server add @nestjs/bullmq bullmq
```

`bullmq` 依赖 `ioredis`，会自动安装。注意：这和现有的 `@keyv/redis`（用 `node-redis`）是两个不同的 Redis 客户端，但连同一个 Redis 实例没有问题。

### 3.2 注册 BullMQ 模块

```ts
// app.module.ts
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    // ...existing modules
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redis = config.get('redis');
        return {
          connection: {
            host: redis.host || 'localhost',
            port: redis.port || 6379,
            password: redis.password || undefined,
            db: redis.db || 0,
          },
        };
      },
    }),
  ],
})
export class AppModule {}
```

### 3.3 定义队列

```ts
// 队列名称常量
export const QUEUES = {
  EMAIL: 'email',
  IMAGE: 'image',
} as const;
```

## 4. 实现一个任务

以发送邮件为例，完整流程。

### 4.1 定义 Producer（生产者）

```ts
// modules/email/email-producer.service.ts
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class EmailProducerService {
  constructor(@InjectQueue(QUEUES.EMAIL) private readonly emailQueue: Queue) {}

  /** 发送欢迎邮件（异步，不阻塞） */
  async sendWelcomeEmail(userId: string, email: string) {
    await this.emailQueue.add('welcome', {
      userId,
      email,
      template: 'welcome',
    }, {
      attempts: 3,           // 失败重试 3 次
      backoff: {
        type: 'exponential', // 指数退避：1s → 2s → 4s
        delay: 1000,
      },
    });
  }

  /** 发送延迟的提醒邮件 */
  async sendReminderEmail(userId: string, email: string, delayMs: number) {
    await this.emailQueue.add('reminder', {
      userId,
      email,
      template: 'reminder',
    }, {
      delay: delayMs,  // 延迟执行
    });
  }
}
```

### 4.2 定义 Consumer（消费者 / Worker）

```ts
// modules/email/email.processor.ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

interface EmailJobData {
  userId: string;
  email: string;
  template: string;
}

@Processor(QUEUES.EMAIL)
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  async process(job: Job<EmailJobData>): Promise<void> {
    this.logger.log(`Processing email job ${job.id}: ${job.name}`);

    switch (job.name) {
      case 'welcome':
        await this.sendWelcome(job.data);
        break;
      case 'reminder':
        await this.sendReminder(job.data);
        break;
      default:
        this.logger.warn(`Unknown job name: ${job.name}`);
    }
  }

  private async sendWelcome(data: EmailJobData) {
    // 实际发送邮件的逻辑
    this.logger.log(`Sending welcome email to ${data.email}`);
    // await this.mailService.send(...)
  }

  private async sendReminder(data: EmailJobData) {
    this.logger.log(`Sending reminder email to ${data.email}`);
  }
}
```

### 4.3 注册模块

```ts
// modules/email/email.module.ts
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    BullModule.registerQueue({
      name: QUEUES.EMAIL,
    }),
  ],
  providers: [EmailProducerService, EmailProcessor],
  exports: [EmailProducerService],
})
export class EmailModule {}
```

### 4.4 在业务中调用

```ts
// modules/auth/auth.service.ts
async register(dto: RegisterDto) {
  const user = await this.usersService.create(dto);

  // 注册成功后异步发邮件，不阻塞响应
  await this.emailProducerService.sendWelcomeEmail(user.id, user.email);

  return user;
}
```

## 5. BullMQ 高级功能

### 5.1 并发控制

```ts
@Processor(QUEUES.IMAGE, { concurrency: 3 }) // 同时处理 3 个任务
export class ImageProcessor extends WorkerHost {
  // ...
}
```

### 5.2 速率限制

```ts
BullModule.registerQueue({
  name: QUEUES.EMAIL,
  defaultJobOptions: {
    // 每分钟最多 10 个邮件任务
    limiter: {
      max: 10,
      duration: 60_000,
    },
  },
});
```

### 5.3 优先级

```ts
// 高优先级任务先执行
await this.emailQueue.add('critical-alert', data, { priority: 1 });
await this.emailQueue.add('newsletter', data, { priority: 10 });
```

### 5.4 任务生命周期事件

```ts
@Processor(QUEUES.EMAIL)
export class EmailProcessor extends WorkerHost {
  // 处理前
  @OnWorkerEvent('active')
  onActive(job: Job) {
    console.log(`Job ${job.id} started`);
  }

  // 完成后
  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    console.log(`Job ${job.id} completed`);
  }

  // 失败后
  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    console.error(`Job ${job.id} failed:`, error.message);
  }
}
```

### 5.5 Cron 定时任务

```ts
import { SchedulerRegistry } from '@nestjs/schedule';

// 添加定时任务
await this.emailQueue.add('daily-report', data, {
  repeat: {
    pattern: '0 9 * * *', // 每天 9 点
  },
});
```

## 6. 监控：Bull Board

Bull Board 提供 Web UI 查看队列状态：

```bash
yarn workspace @my-first-nest/server add @bull-board/api @bull-board/express
```

```ts
// 在 main.ts 或独立模块中配置
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [new BullMQAdapter(emailQueue)],
  serverAdapter,
});

app.use('/admin/queues', serverAdapter.getRouter());
```

访问 `/admin/queues` 即可看到队列、任务状态、失败原因等。

## 7. 与现有项目的集成点

| 业务场景 | 队列名 | 任务类型 |
| --- | --- | --- |
| 用户注册发邮件 | `email` | welcome, verify |
| 头像上传裁剪 | `image` | resize, watermark |
| 缓存预热 | `cache` | warmup, invalidate |
| 日志/审计异步写入 | `audit` | log-action |

## 8. 注意事项

- **Worker 和 Web 分开部署**：生产环境建议 Worker 和 API 分进程，避免 CPU 密集任务阻塞请求处理。
- **Redis 持久化**：AOF 必须开启，否则 Redis 重启后未完成的任务丢失。
- **幂等性**：Worker 可能因重试执行同一任务多次，业务逻辑要保证幂等。
- **内存**：大量任务堆积时 Redis 内存会增长，注意设置 `removeOnComplete` 和 `removeOnFail`。
- **ioredis vs node-redis**：BullMQ 用 `ioredis`，现有 CacheService 用 `node-redis`。两者共存没问题，但不要混用。

```ts
// 自动清理已完成/失败的任务
BullModule.registerQueue({
  name: QUEUES.EMAIL,
  defaultJobOptions: {
    removeOnComplete: { count: 1000 }, // 保留最近 1000 个
    removeOnFail: { count: 5000 },     // 保留最近 5000 个失败的（便于排查）
  },
});
```
