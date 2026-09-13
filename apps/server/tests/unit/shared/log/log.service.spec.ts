import { ErrorExceptionCode } from '@/common/exceptions/error.exception';
import { LOG_LEVEL } from '@/shared/log/constants/log.constants';
import { LogRecord } from '@/shared/log/entities/log-record.entity';
import { LogService } from '@/shared/log/log.service';
import { Repository } from 'typeorm';
import { beforeEach, describe, expect, it, MockInstance, vi } from 'vitest';

type MockQueryBuilder = {
  addOrderBy: MockInstance<(column: string, order: string) => MockQueryBuilder>;
  andWhere: MockInstance<
    (
      condition: string,
      parameters?: Record<string, unknown>,
    ) => MockQueryBuilder
  >;
  getManyAndCount: MockInstance<() => Promise<[LogRecord[], number]>>;
  orderBy: MockInstance<(column: string, order: string) => MockQueryBuilder>;
  skip: MockInstance<(offset: number) => MockQueryBuilder>;
  take: MockInstance<(limit: number) => MockQueryBuilder>;
};

type MockRepository = {
  createQueryBuilder: MockInstance<() => MockQueryBuilder>;
  findOneBy: MockInstance<(where: { id: string }) => Promise<LogRecord | null>>;
};

const createRecord = (): LogRecord => ({
  id: '9001',
  level: LOG_LEVEL.ERROR,
  category: 'HTTP',
  message: 'request failed',
  context: { statusCode: 500 },
  requestId: 'request-1',
  userId: 'user-1',
  ip: '127.0.0.1',
  method: 'GET',
  url: '/api/logs',
  statusCode: 500,
  duration: 12,
  stack: 'Error: request failed',
  timestamp: new Date('2026-09-10T10:00:00.000Z'),
});

const createQueryBuilder = (): MockQueryBuilder => {
  const queryBuilder = {
    addOrderBy: vi.fn(),
    andWhere: vi.fn(),
    getManyAndCount: vi.fn(),
    orderBy: vi.fn(),
    skip: vi.fn(),
    take: vi.fn(),
  } as MockQueryBuilder;

  queryBuilder.addOrderBy.mockReturnValue(queryBuilder);
  queryBuilder.andWhere.mockReturnValue(queryBuilder);
  queryBuilder.orderBy.mockReturnValue(queryBuilder);
  queryBuilder.skip.mockReturnValue(queryBuilder);
  queryBuilder.take.mockReturnValue(queryBuilder);
  return queryBuilder;
};

const createRepository = (): MockRepository => ({
  createQueryBuilder: vi.fn(),
  findOneBy: vi.fn(),
});

const createService = () => {
  const repository = createRepository();
  const service = new LogService(
    repository as unknown as Repository<LogRecord>,
  );

  return { repository, service };
};

describe('LogService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('applies query filters and pagination in a stable order', async () => {
    const { repository, service } = createService();
    const queryBuilder = createQueryBuilder();
    const records = [createRecord()];

    repository.createQueryBuilder.mockReturnValue(queryBuilder);
    queryBuilder.getManyAndCount.mockResolvedValue([records, 1]);

    const result = await service.list({
      page: 2,
      pageSize: 20,
      level: LOG_LEVEL.ERROR,
      category: 'HTTP',
      userId: 'user-1',
      requestId: 'request-1',
      startTime: new Date('2026-09-01T00:00:00.000Z'),
      endTime: new Date('2026-09-02T00:00:00.000Z'),
      keyword: 'token',
    });

    expect(repository.createQueryBuilder).toHaveBeenCalledWith('log');
    expect(queryBuilder.andWhere).toHaveBeenCalledWith('log.level = :level', {
      level: LOG_LEVEL.ERROR,
    });
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'log.category = :category',
      { category: 'HTTP' },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith('log.userId = :userId', {
      userId: 'user-1',
    });
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'log.requestId = :requestId',
      { requestId: 'request-1' },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'log.timestamp >= :startTime',
      { startTime: new Date('2026-09-01T00:00:00.000Z') },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'log.timestamp <= :endTime',
      { endTime: new Date('2026-09-02T00:00:00.000Z') },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'log.message ILIKE :keyword',
      { keyword: '%token%' },
    );
    expect(queryBuilder.orderBy).toHaveBeenCalledWith('log.timestamp', 'DESC');
    expect(queryBuilder.addOrderBy).toHaveBeenCalledWith('log.id', 'DESC');
    expect(queryBuilder.skip).toHaveBeenCalledWith(20);
    expect(queryBuilder.take).toHaveBeenCalledWith(20);
    expect(result).toEqual({
      items: records,
      total: 1,
      page: 2,
      pageSize: 20,
    });
  });

  it('uses default pagination and omits empty filters', async () => {
    const { repository, service } = createService();
    const queryBuilder = createQueryBuilder();

    repository.createQueryBuilder.mockReturnValue(queryBuilder);
    queryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

    await service.list({});

    expect(queryBuilder.andWhere).not.toHaveBeenCalled();
    expect(queryBuilder.addOrderBy).toHaveBeenCalledWith('log.id', 'DESC');
    expect(queryBuilder.skip).toHaveBeenCalledWith(0);
    expect(queryBuilder.take).toHaveBeenCalledWith(20);
  });

  it('returns a log record by id', async () => {
    const { repository, service } = createService();
    const record = createRecord();

    repository.findOneBy.mockResolvedValue(record);

    await expect(service.getById(record.id)).resolves.toEqual(record);
    expect(repository.findOneBy).toHaveBeenCalledWith({ id: record.id });
  });

  it('throws LOG_NOT_FOUND when the log record does not exist', async () => {
    const { repository, service } = createService();

    repository.findOneBy.mockResolvedValue(null);

    await expect(service.getById('999999')).rejects.toMatchObject({
      code: ErrorExceptionCode.LOG_NOT_FOUND,
    });
  });

  it('rejects an invalid bigint id without querying the database', async () => {
    const { repository, service } = createService();

    await expect(service.getById('missing')).rejects.toMatchObject({
      code: ErrorExceptionCode.LOG_NOT_FOUND,
    });
    expect(repository.findOneBy).not.toHaveBeenCalled();
  });
});
