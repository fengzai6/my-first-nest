import { AppConfigModule } from '@/config/config.module';
import { getConfig } from '@/config/configuration';
import { UsersModule } from '@/modules/users/users.module';
import { InjectQueue } from '@nestjs/bullmq';
import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpAdapterHost } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { Queue } from 'bullmq';
import { Express } from 'express';
import { DEFAULT_JOB_QUEUE } from '../constants/job.constants';
import { JobQueueModule } from '../queue/job-queue.module';
import { IBullJobData } from '../types/job.types';
import { JobBoardAuthMiddleware } from './job-board.auth.middleware';

const JOB_BOARD_PATH = '/admin/queues';

@Module({
  imports: [
    UsersModule,
    JobQueueModule,
    JwtModule.registerAsync({
      imports: [AppConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const { jwt } = getConfig(configService);
        return {
          secret: jwt.secret,
          signOptions: { expiresIn: jwt.accessExpiresIn },
        };
      },
    }),
  ],
  providers: [JobBoardAuthMiddleware],
})
export class JobBoardModule implements OnModuleInit {
  constructor(
    private readonly httpAdapterHost: HttpAdapterHost,
    private readonly authMiddleware: JobBoardAuthMiddleware,
    @InjectQueue(DEFAULT_JOB_QUEUE)
    private readonly defaultQueue: Queue<IBullJobData>,
  ) {}

  onModuleInit() {
    const serverAdapter = new ExpressAdapter();
    serverAdapter.setBasePath(JOB_BOARD_PATH);

    createBullBoard({
      queues: [new BullMQAdapter(this.defaultQueue)],
      serverAdapter,
    });

    const app: Express =
      this.httpAdapterHost.httpAdapter.getInstance<Express>();
    app.use(JOB_BOARD_PATH, this.authMiddleware.use.bind(this.authMiddleware));
    app.use(JOB_BOARD_PATH, serverAdapter.getRouter());
  }
}
