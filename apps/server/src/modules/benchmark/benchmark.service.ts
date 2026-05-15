import { CacheKeys } from '@/shared/caching/cache.constants';
import { CacheService } from '@/shared/caching/cache.service';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';

@Injectable()
export class BenchmarkService {
  private readonly logger = new Logger(BenchmarkService.name);

  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * 单次查询对比：数据库 vs Redis 缓存
   */
  async singleQuery(userId?: string) {
    // 如果没有指定 userId，获取第一个用户
    if (!userId) {
      const user = await this.userRepository.findOne({ where: {} });
      if (!user) {
        return { error: '数据库中没有用户数据，请先创建用户' };
      }
      userId = user.id;
    }

    const cacheKey = CacheKeys.USER_BY_ID(userId);

    // 清除缓存，确保冷启动
    await this.cacheService.del(cacheKey);

    // 测试数据库查询
    const dbStart = performance.now();
    const dbResult = await this.userRepository.findOne({
      where: { id: userId },
      relations: { roles: true },
    });
    const dbTime = performance.now() - dbStart;

    // 写入缓存
    await this.cacheService.set(cacheKey, dbResult, 300);

    // 测试缓存查询
    const cachedStart = performance.now();
    const cachedResult = await this.cacheService.get(cacheKey);
    const cachedTime = performance.now() - cachedStart;

    return {
      userId,
      database: {
        time: `${dbTime.toFixed(2)}ms`,
        result: dbResult ? 'found' : 'not found',
      },
      cached: {
        time: `${cachedTime.toFixed(2)}ms`,
        result: cachedResult ? 'hit' : 'miss',
      },
      speedup: `${(dbTime / cachedTime).toFixed(1)}x`,
    };
  }

  /**
   * 批量查询对比：数据库 vs Redis 缓存
   */
  async batchQuery(count: number = 100) {
    // 获取所有用户 ID
    const users = await this.userRepository.find({ select: ['id'] });
    if (users.length === 0) {
      return { error: '数据库中没有用户数据，请先创建用户' };
    }

    const userIds = users.map((u) => u.id);

    // 清除所有用户缓存
    for (const id of userIds) {
      await this.cacheService.del(CacheKeys.USER_BY_ID(id));
    }

    // 测试数据库批量查询
    const dbStart = performance.now();
    for (let i = 0; i < count; i++) {
      const id = userIds[i % userIds.length];
      await this.userRepository.findOne({
        where: { id },
        relations: { roles: true },
      });
    }
    const dbTime = performance.now() - dbStart;

    // 预热缓存
    for (const id of userIds) {
      const user = await this.userRepository.findOne({
        where: { id },
        relations: { roles: true },
      });
      await this.cacheService.set(CacheKeys.USER_BY_ID(id), user, 300);
    }

    // 测试缓存批量查询
    const cachedStart = performance.now();
    for (let i = 0; i < count; i++) {
      const id = userIds[i % userIds.length];
      await this.cacheService.get(CacheKeys.USER_BY_ID(id));
    }
    const cachedTime = performance.now() - cachedStart;

    return {
      queryCount: count,
      availableUsers: userIds.length,
      database: {
        totalTime: `${dbTime.toFixed(2)}ms`,
        avgTime: `${(dbTime / count).toFixed(2)}ms`,
      },
      cached: {
        totalTime: `${cachedTime.toFixed(2)}ms`,
        avgTime: `${(cachedTime / count).toFixed(2)}ms`,
      },
      speedup: `${(dbTime / cachedTime).toFixed(1)}x`,
    };
  }

  /**
   * 场景测试：冷启动 vs 热缓存
   */
  async scenarioTest() {
    // 获取所有用户 ID
    const users = await this.userRepository.find({ select: ['id'] });
    if (users.length === 0) {
      return { error: '数据库中没有用户数据，请先创建用户' };
    }

    const userIds = users.map((u) => u.id);

    // 1. 冷启动：清除缓存后查询
    for (const id of userIds) {
      await this.cacheService.del(CacheKeys.USER_BY_ID(id));
    }

    const coldStart = performance.now();
    for (const id of userIds) {
      await this.userRepository.findOne({
        where: { id },
        relations: { roles: true },
      });
    }
    const coldTime = performance.now() - coldStart;

    // 2. 写入缓存
    for (const id of userIds) {
      const user = await this.userRepository.findOne({
        where: { id },
        relations: { roles: true },
      });
      await this.cacheService.set(CacheKeys.USER_BY_ID(id), user, 300);
    }

    // 3. 热缓存：从缓存查询
    const warmStart = performance.now();
    for (const id of userIds) {
      await this.cacheService.get(CacheKeys.USER_BY_ID(id));
    }
    const warmTime = performance.now() - warmStart;

    return {
      totalUsers: userIds.length,
      coldStart: {
        description: '无缓存，直接查询数据库',
        totalTime: `${coldTime.toFixed(2)}ms`,
        avgTime: `${(coldTime / userIds.length).toFixed(2)}ms`,
      },
      warmCache: {
        description: '缓存预热后，从 Redis 查询',
        totalTime: `${warmTime.toFixed(2)}ms`,
        avgTime: `${(warmTime / userIds.length).toFixed(2)}ms`,
      },
      improvement: `${((1 - warmTime / coldTime) * 100).toFixed(1)}%`,
      speedup: `${(coldTime / warmTime).toFixed(1)}x`,
    };
  }
}
