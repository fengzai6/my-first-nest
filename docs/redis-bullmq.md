# BullMQ 任务队列

> 用 BullMQ + Redis 实现异步任务处理。

## 1. 为什么需要任务队列

有些操作不适合在请求链路中同步执行：

- **图片处理**：上传头像后生成缩略图、压缩图，耗时几秒，同步等待体验差
- **数据同步**：用户更新信息后同步到 ES / 第三方服务
- **定时清理**：按计划清理过期文件、临时数据或历史日志

任务队列的模式：

```txt
生产者（API 请求）→ 队列（Redis）→ 消费者（Worker 进程）
```

API 只负责把任务放进队列并返回结果。Worker 在后台消费任务。

## 2. 为什么选 BullMQ

| 方案 | 说明 |
| --- | --- |
| BullMQ | 成熟的 Node.js 任务队列，基于 Redis，支持延迟任务、重试、优先级、并发控制 |
| Bull | BullMQ 的前身，维护活跃度不如 BullMQ |
| Agenda | 基于 MongoDB，适合已有 MongoDB 的项目 |
| 自己用 Redis List | 简单场景可以，但缺少重试、延迟、监控等工程能力 |

BullMQ 优势：

- 延迟任务（`delay`）
- 失败自动重试（`attempts` + `backoff`）
- 优先级队列（`priority`）
- 并发控制（`concurrency`）
- 全局速率限制（`setGlobalRateLimit`）
- 可视化监控（Bull Board）
- NestJS 集成（`@nestjs/bullmq`）

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
// common/constants/queue.constants.ts
export const QUEUES = {
  IMAGE: 'image',
  CACHE: 'cache',
  AUDIT: 'audit',
} as const;
```

队列名建议使用业务能力命名，不要使用具体实现命名。比如 `image` 表示图片处理队列，里面可以包含 `resize`、`cleanup-temp`、`cleanup-expired-temp` 等多种任务。

## 4. 实现一个任务

以图片处理为例，完整流程如下。

### 4.1 定义 Producer（生产者）

```ts
// modules/image/image-producer.service.ts
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { QUEUES } from '@/common/constants/queue.constants';

interface IResizeImageJobData {
  imageId: string;
  userId: string;
  sourcePath: string;
  sizes: number[];
}

interface ICleanupImageJobData {
  imageId: string;
  tempPath: string;
}

interface ICleanupExpiredTempJobData {
  beforeHours: number;
}

type IImageJobData =
  | IResizeImageJobData
  | ICleanupImageJobData
  | ICleanupExpiredTempJobData;

@Injectable()
export class ImageProducerService {
  constructor(
    @InjectQueue(QUEUES.IMAGE)
    private readonly imageQueue: Queue<IImageJobData>,
  ) {}

  /** 异步生成缩略图，不阻塞请求响应 */
  async resizeImage(data: IResizeImageJobData): Promise<void> {
    await this.imageQueue.add('resize', data, {
      jobId: `image:${data.imageId}:resize`,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
    });
  }

  /** 延迟清理图片临时文件 */
  async cleanupTempFile(data: ICleanupImageJobData, delayMs: number): Promise<void> {
    await this.imageQueue.add(
      'cleanup-temp',
      data,
      {
        jobId: `image:${data.imageId}:cleanup-temp`,
        delay: delayMs,
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
      },
    );
  }
}
```

关键点：

- `jobId` 用业务唯一键生成，避免重复入队。
- `attempts` + `backoff` 只适合可重试任务；不可重试错误应在 Worker 内直接失败并记录原因。
- `removeOnComplete` / `removeOnFail` 控制 Redis 中保留的任务数量，避免无限增长。

### 4.2 定义 Consumer（消费者 / Worker）

```ts
// modules/image/image.processor.ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUES } from '@/common/constants/queue.constants';

interface IResizeImageJobData {
  imageId: string;
  userId: string;
  sourcePath: string;
  sizes: number[];
}

interface ICleanupImageJobData {
  imageId: string;
  tempPath: string;
}

interface ICleanupExpiredTempJobData {
  beforeHours: number;
}

type IImageJobData =
  | IResizeImageJobData
  | ICleanupImageJobData
  | ICleanupExpiredTempJobData;

@Processor(QUEUES.IMAGE, { concurrency: 3 })
export class ImageProcessor extends WorkerHost {
  private readonly logger = new Logger(ImageProcessor.name);

  async process(job: Job<IImageJobData>): Promise<void> {
    this.logger.log(`Processing image job ${job.id}: ${job.name}`);

    switch (job.name) {
      case 'resize':
        if (!this.isResizeJobData(job.data)) {
          throw new Error(`Invalid resize job data: ${job.id}`);
        }

        await this.resize(job.data);
        break;
      case 'cleanup-temp':
        if (!this.isCleanupJobData(job.data)) {
          throw new Error(`Invalid cleanup job data: ${job.id}`);
        }

        await this.cleanupTemp(job.data);
        break;
      case 'cleanup-expired-temp':
        if (!this.isCleanupExpiredTempJobData(job.data)) {
          throw new Error(`Invalid cleanup expired temp job data: ${job.id}`);
        }

        await this.cleanupExpiredTemp(job.data.beforeHours);
        break;
      default:
        this.logger.warn(`Unknown job name: ${job.name}`);
    }
  }

  private async resize(data: IResizeImageJobData): Promise<void> {
    // 处理前先检查图片状态，避免重试时重复生成或覆盖有效结果。
    this.logger.log(`Resizing image ${data.imageId} for user ${data.userId}`);
    // await this.imageService.resize(data.imageId, data.sourcePath, data.sizes);
  }

  private async cleanupTemp(data: ICleanupImageJobData): Promise<void> {
    this.logger.log(`Cleaning temp file for image ${data.imageId}`);
    // await this.imageService.cleanupTemp(data.imageId, data.tempPath);
  }

  private async cleanupExpiredTemp(beforeHours: number): Promise<void> {
    this.logger.log(`Cleaning temp files older than ${beforeHours} hours`);
    // await this.imageService.cleanupExpiredTemp(beforeHours);
  }

  private isResizeJobData(data: IImageJobData): data is IResizeImageJobData {
    return 'userId' in data && 'sourcePath' in data && 'sizes' in data;
  }

  private isCleanupJobData(data: IImageJobData): data is ICleanupImageJobData {
    return 'tempPath' in data;
  }

  private isCleanupExpiredTempJobData(
    data: IImageJobData,
  ): data is ICleanupExpiredTempJobData {
    return 'beforeHours' in data;
  }
}
```

Worker 需要保证幂等：同一个任务可能因为重试、进程重启、网络抖动而执行多次。处理前应检查业务状态，处理后再更新状态。

### 4.3 注册模块

```ts
// modules/image/image.module.ts
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QUEUES } from '@/common/constants/queue.constants';
import { ImageProcessor } from './image.processor';
import { ImageProducerService } from './image-producer.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: QUEUES.IMAGE,
      defaultJobOptions: {
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
      },
    }),
  ],
  providers: [ImageProducerService, ImageProcessor],
  exports: [ImageProducerService],
})
export class ImageModule {}
```

### 4.4 在业务中调用

```ts
// modules/image/image.service.ts
async uploadAvatar(file: Express.Multer.File, userId: string) {
  const image = await this.createPendingImage(file, userId);

  await this.imageProducerService.resizeImage({
    imageId: image.id,
    userId,
    sourcePath: image.sourcePath,
    sizes: [128, 256, 512],
  });

  return image;
}
```

接口返回的是图片记录，不是最终处理结果。前端可以轮询图片状态，或通过 WebSocket 接收完成通知。

## 5. BullMQ 高级功能

### 5.1 并发控制

```ts
@Processor(QUEUES.IMAGE, { concurrency: 3 })
export class ImageProcessor extends WorkerHost {
  // 同时处理 3 个图片任务。
}
```

并发数要按任务类型设置：CPU 密集型任务不要过高，I/O 密集型任务可以适当提高。

### 5.2 全局速率限制

```ts
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';

@Injectable()
export class ImageQueueLimiter implements OnModuleInit {
  constructor(@InjectQueue(QUEUES.IMAGE) private readonly imageQueue: Queue) {}

  async onModuleInit(): Promise<void> {
    await this.imageQueue.setGlobalRateLimit(10, 60_000);
  }
}
```

全局速率限制适合控制图片处理压力、外部服务调用或数据库写入压力。它限制的是队列整体处理速度，不是单个用户的接口请求频率。

### 5.3 优先级

```ts
await this.imageQueue.add('resize', avatarData, { priority: 1 });
await this.imageQueue.add('resize', galleryData, { priority: 10 });
```

数字越小优先级越高。优先级适合少量关键任务，不建议把所有任务都做复杂分级。

### 5.4 任务生命周期事件

```ts
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

@Processor(QUEUES.IMAGE)
export class ImageProcessor extends WorkerHost {
  @OnWorkerEvent('active')
  onActive(job: Job): void {
    console.log(`Job ${job.id} started`);
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job): void {
    console.log(`Job ${job.id} completed`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error): void {
    console.error(`Job ${job.id} failed:`, error.message);
  }
}
```

生产环境建议用项目统一的 `Logger`，并在日志中记录 `job.id`、`job.name` 和关键业务 ID。

### 5.5 Cron 定时任务

BullMQ 5.16.0+ 推荐使用 Job Scheduler 管理重复任务：

```ts
await this.imageQueue.upsertJobScheduler(
  'daily-temp-image-cleanup',
  { pattern: '0 9 * * *' },
  {
    name: 'cleanup-expired-temp',
    data: { beforeHours: 24 },
    opts: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
    },
  },
);
```

使用 `upsertJobScheduler` 可以避免生产部署时重复创建定时任务。定时任务生成频率还会受队列繁忙程度和 Worker 并发影响。

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
  queues: [new BullMQAdapter(imageQueue)],
  serverAdapter,
});

app.use('/admin/queues', serverAdapter.getRouter());
```

访问 `/admin/queues` 即可看到队列、任务状态、失败原因等。管理入口应加鉴权，不要暴露给公网匿名访问。

## 7. 与现有项目的集成点

| 业务场景 | 队列名 | 任务类型 |
| --- | --- | --- |
| 头像上传裁剪 | `image` | resize, cleanup-temp, cleanup-expired-temp |
| 缓存预热 | `cache` | warmup, invalidate |
| 日志/审计异步写入 | `audit` | log-action |

## 8. 注意事项

- **Worker 和 Web 分开部署**：生产环境建议 Worker 和 API 分进程，避免 CPU 密集任务阻塞请求处理。
- **Redis 持久化**：开启 AOF 或合适的持久化策略，否则 Redis 重启后未完成任务可能丢失。
- **幂等性**：Worker 可能因重试执行同一任务多次，业务逻辑必须能重复执行。
- **任务粒度**：任务数据只放必要 ID 和参数，不要把大对象、文件内容或敏感信息直接塞进 Redis。
- **失败处理**：区分可重试错误和不可重试错误，失败日志要包含可定位业务数据。
- **内存控制**：大量任务堆积时 Redis 内存会增长，设置 `removeOnComplete` 和 `removeOnFail`。
- **ioredis vs node-redis**：BullMQ 用 `ioredis`，现有 CacheService 用 `node-redis`。两者共存没问题，但不要混用客户端实例。

```ts
BullModule.registerQueue({
  name: QUEUES.IMAGE,
  defaultJobOptions: {
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
  },
});
```
