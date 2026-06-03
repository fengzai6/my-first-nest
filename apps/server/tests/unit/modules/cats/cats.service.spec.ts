import { ErrorExceptionCode } from '@/common/exceptions/error.exception';
import { Cat } from '@/modules/cats/entities/cat.entity';
import { CatsService } from '@/modules/cats/cats.service';
import { User } from '@/modules/users/entities/user.entity';
import { UsersService } from '@/modules/users/users.service';
import { beforeEach, describe, expect, it, MockInstance, vi } from 'vitest';

type MockRepository = {
  create: MockInstance<(value: Partial<Cat>) => Cat>;
  find: MockInstance<() => Promise<Cat[]>>;
  findOneBy: MockInstance<(value: { id: string }) => Promise<Cat | null>>;
  save: MockInstance<(value: Cat) => Promise<Cat>>;
  softDelete: MockInstance<(id: string) => Promise<{ affected: number }>>;
};

type MockUsersService = {
  findOne: MockInstance<(value: { id: string }) => Promise<User>>;
};

const createUser = () => {
  const user = new User();
  user.id = 'user-id';
  user.username = 'fengzai';
  return user;
};

const createCat = ({
  id = 'cat-id',
  name = 'Mimi',
  age = 2,
  breed = 'British Shorthair',
}: Partial<Cat> = {}) => {
  const cat = new Cat();
  cat.id = id;
  cat.name = name;
  cat.age = age;
  cat.breed = breed;
  return cat;
};

const createRepository = (): MockRepository => ({
  create: vi.fn((value: Partial<Cat>) => Object.assign(new Cat(), value)),
  find: vi.fn(),
  findOneBy: vi.fn(),
  save: vi.fn((value: Cat) => Promise.resolve(value)),
  softDelete: vi.fn(),
});

const createService = () => {
  const repository = createRepository();
  const usersService: MockUsersService = {
    findOne: vi.fn(),
  };

  return {
    repository,
    usersService,
    service: new CatsService(
      usersService as unknown as UsersService,
      repository as never,
    ),
  };
};

describe('CatsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a cat from dto', async () => {
    const { service, repository } = createService();
    const createCatDto = {
      name: 'Mimi',
      age: 2,
      breed: 'British Shorthair',
    };

    const result = await service.create(createCatDto);

    expect(repository.create).toHaveBeenCalledWith(createCatDto);
    expect(repository.save).toHaveBeenCalledWith(expect.any(Cat));
    expect(result).toMatchObject(createCatDto);
  });

  it('should find all cats', async () => {
    const { service, repository } = createService();
    const cats = [createCat()];

    repository.find.mockResolvedValue(cats);

    await expect(service.findAll()).resolves.toBe(cats);
  });

  it('should find one cat by id', async () => {
    const { service, repository } = createService();
    const cat = createCat();

    repository.findOneBy.mockResolvedValue(cat);

    await expect(service.findOne('cat-id')).resolves.toBe(cat);
    expect(repository.findOneBy).toHaveBeenCalledWith({ id: 'cat-id' });
  });

  it('should throw when cat is not found', async () => {
    const { service, repository } = createService();

    repository.findOneBy.mockResolvedValue(null);

    await expect(service.findOne('missing-id')).rejects.toMatchObject({
      code: ErrorExceptionCode.CAT_NOT_FOUND,
    });
  });

  it('should update cat owner after checking cat and user exist', async () => {
    const { service, repository, usersService } = createService();
    const cat = createCat();
    const owner = createUser();

    repository.findOneBy.mockResolvedValue(cat);
    usersService.findOne.mockResolvedValue(owner);

    const result = await service.updateOwner('cat-id', { ownerId: 'user-id' });

    expect(usersService.findOne).toHaveBeenCalledWith({ id: 'user-id' });
    expect(repository.save).toHaveBeenCalledWith(cat);
    expect(result.owner).toBe(owner);
  });

  it('should stop owner update when cat is missing', async () => {
    const { service, repository, usersService } = createService();

    repository.findOneBy.mockResolvedValue(null);

    await expect(
      service.updateOwner('missing-cat-id', { ownerId: 'user-id' }),
    ).rejects.toMatchObject({
      code: ErrorExceptionCode.CAT_NOT_FOUND,
    });
    expect(usersService.findOne).not.toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('should soft delete cat', async () => {
    const { service, repository } = createService();

    repository.softDelete.mockResolvedValue({ affected: 1 });

    const response = await service.remove('cat-id');

    expect(repository.softDelete).toHaveBeenCalledWith('cat-id');
    expect(response.message).toBe('Cat deleted successfully');
  });

  it('should throw when deleted cat does not exist', async () => {
    const { service, repository } = createService();

    repository.softDelete.mockResolvedValue({ affected: 0 });

    await expect(service.remove('missing-id')).rejects.toMatchObject({
      code: ErrorExceptionCode.CAT_NOT_FOUND,
    });
  });
});
