import { userContextStorage } from '@/common/context/user-context';
import { GroupMemberRolesEnum } from '@/common/decorators/group-member-roles.decorator';
import { GroupExceptionCode } from '@/common/exceptions/group.exception';
import { GroupMember } from '@/modules/groups/entities/group-member.entity';
import { Group } from '@/modules/groups/entities/group.entity';
import { GroupsService } from '@/modules/groups/groups.service';
import { User } from '@/modules/users/entities/user.entity';
import { beforeEach, describe, expect, it, MockInstance, vi } from 'vitest';

type MockQueryBuilder = {
  getMany: MockInstance<() => Promise<Group[]>>;
  leftJoinAndSelect: MockInstance<() => MockQueryBuilder>;
  where: MockInstance<() => MockQueryBuilder>;
};

type MockTreeRepository = {
  create: MockInstance<(value: Partial<Group>) => Group>;
  createQueryBuilder: MockInstance<() => MockQueryBuilder>;
  find: MockInstance<(value?: unknown) => Promise<Group[]>>;
  findAncestors: MockInstance<(value: Group) => Promise<Group[]>>;
  findOne: MockInstance<(value: unknown) => Promise<Group | null>>;
  findTrees: MockInstance<(value: unknown) => Promise<Group[]>>;
  merge: MockInstance<(target: Group, source: Partial<Group>) => Group>;
  save: MockInstance<(value: Group) => Promise<Group>>;
};

type MockGroupMemberRepository = {
  create: MockInstance<(value: Partial<GroupMember>) => GroupMember>;
  find: MockInstance<(value: unknown) => Promise<GroupMember[]>>;
  findOne: MockInstance<(value: unknown) => Promise<GroupMember | null>>;
  manager: {
    transaction: MockInstance<
      (
        callback: (manager: MockTransactionManager) => Promise<GroupMember>,
      ) => Promise<GroupMember>
    >;
  };
  remove: MockInstance<(value: GroupMember) => Promise<GroupMember>>;
  save: MockInstance<
    (value: GroupMember | GroupMember[]) => Promise<GroupMember | GroupMember[]>
  >;
};

type MockTransactionManager = {
  getRepository: MockInstance<
    (entity: typeof Group | typeof GroupMember) => MockTransactionRepository
  >;
};

type MockTransactionRepository = {
  findOne: MockInstance<
    (value: unknown) => Promise<Group | GroupMember | null>
  >;
  save: MockInstance<(value: GroupMember) => Promise<GroupMember>>;
};

const createUser = (id = 'user-id') => {
  const user = new User();
  user.id = id;
  return user;
};

const createGroup = ({
  id = 'group-id',
  name = 'Group',
  isOrganization = false,
  parent,
  organizationGroup,
}: Partial<Group> = {}) => {
  const group = new Group();
  group.id = id;
  group.name = name;
  group.isOrganization = isOrganization;
  group.parent = parent as Group;
  group.organizationGroup = organizationGroup as Group;
  group.children = [];
  return group;
};

const createGroupMember = ({
  group = createGroup(),
  user = createUser(),
  role = GroupMemberRolesEnum.Member,
}: Partial<GroupMember> = {}) => {
  const groupMember = new GroupMember();
  groupMember.group = group;
  groupMember.user = user;
  groupMember.role = role;
  return groupMember;
};

const createQueryBuilder = (): MockQueryBuilder => {
  const queryBuilder = {
    getMany: vi.fn(),
    leftJoinAndSelect: vi.fn(),
    where: vi.fn(),
  } as MockQueryBuilder;

  queryBuilder.leftJoinAndSelect.mockReturnValue(queryBuilder);
  queryBuilder.where.mockReturnValue(queryBuilder);
  return queryBuilder;
};

const createTreeRepository = (): MockTreeRepository => ({
  create: vi.fn((value: Partial<Group>) => Object.assign(new Group(), value)),
  createQueryBuilder: vi.fn(() => createQueryBuilder()),
  find: vi.fn(),
  findAncestors: vi.fn(),
  findOne: vi.fn(),
  findTrees: vi.fn(),
  merge: vi.fn((target: Group, source: Partial<Group>) =>
    Object.assign(target, source),
  ),
  save: vi.fn((value: Group) => Promise.resolve(value)),
});

const createGroupMemberRepository = (): MockGroupMemberRepository => {
  const repository = {
    create: vi.fn((value: Partial<GroupMember>) =>
      Object.assign(new GroupMember(), value),
    ),
    find: vi.fn(),
    findOne: vi.fn(),
    manager: {
      transaction: vi.fn(
        async (
          callback: (manager: MockTransactionManager) => Promise<GroupMember>,
        ) => {
          const transactionRepository: MockTransactionRepository = {
            findOne: vi.fn(() => Promise.resolve(null)),
            save: vi.fn((value: GroupMember) => Promise.resolve(value)),
          };
          const manager: MockTransactionManager = {
            getRepository: vi.fn(() => transactionRepository),
          };
          return callback(manager);
        },
      ),
    },
    remove: vi.fn((value: GroupMember) => Promise.resolve(value)),
    save: vi.fn((value: GroupMember | GroupMember[]) => Promise.resolve(value)),
  };

  return repository;
};

const createService = () => {
  const groupTreeRepository = createTreeRepository();
  const groupMemberRepository = createGroupMemberRepository();

  return {
    groupTreeRepository,
    groupMemberRepository,
    service: new GroupsService(
      groupTreeRepository as never,
      groupMemberRepository as never,
    ),
  };
};

describe('GroupsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return superior leader when user leads an ancestor group', async () => {
    const { service, groupTreeRepository, groupMemberRepository } =
      createService();
    const root = createGroup({ id: 'root-id' });
    const child = createGroup({ id: 'child-id', parent: root });

    groupTreeRepository.findOne.mockResolvedValue(child);
    groupMemberRepository.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(createGroupMember({ group: root }));
    groupTreeRepository.findAncestors.mockResolvedValue([root, child]);

    await expect(
      service.getGroupMemberRole('child-id', 'user-id'),
    ).resolves.toBe(GroupMemberRolesEnum.SuperiorLeader);
  });

  it('should return null when group exists but user is not member', async () => {
    const { service, groupTreeRepository, groupMemberRepository } =
      createService();
    const group = createGroup();

    groupTreeRepository.findOne.mockResolvedValue(group);
    groupMemberRepository.findOne.mockResolvedValue(null);
    groupTreeRepository.findAncestors.mockResolvedValue([group]);

    await expect(
      service.getGroupMemberRole('group-id', 'user-id'),
    ).resolves.toBeNull();
  });

  it('should require parent when creating non-organization group', async () => {
    const { service, groupTreeRepository } = createService();

    await userContextStorage.run(createUser(), async () => {
      await expect(
        service.createGroup({
          name: 'Child',
          isOrganization: false,
        }),
      ).rejects.toMatchObject({
        code: GroupExceptionCode.PARENT_GROUP_IS_REQUIRED,
      });
    });
    expect(groupTreeRepository.save).not.toHaveBeenCalled();
  });

  it('should create organization group without parent', async () => {
    const { service, groupTreeRepository } = createService();

    groupTreeRepository.save.mockImplementation((value: Group) => {
      value.id = 'saved-group-id';
      return Promise.resolve(value);
    });

    const result = await userContextStorage.run(createUser(), () =>
      service.createGroup({
        name: 'Root Org',
        isOrganization: true,
      }),
    );

    expect(groupTreeRepository.create).toHaveBeenCalledWith({
      name: 'Root Org',
      description: undefined,
      isOrganization: true,
    });
    expect(result.id).toBe('saved-group-id');
  });

  it('should set parent and organization when creating child group', async () => {
    const { service, groupTreeRepository } = createService();
    const parent = createGroup({ id: 'parent-id', isOrganization: true });

    groupTreeRepository.findOne.mockResolvedValue(parent);

    const result = await userContextStorage.run(createUser(), () =>
      service.createGroup({
        name: 'Child',
        parentId: 'parent-id',
      }),
    );

    expect(result.parent).toBe(parent);
    expect(result.organizationGroup).toBe(parent);
  });

  it('should add current user as member when requested', async () => {
    const { service, groupTreeRepository, groupMemberRepository } =
      createService();
    const savedGroup = createGroup({ id: 'saved-group-id' });

    groupTreeRepository.save.mockImplementation((value: Group) => {
      Object.assign(value, savedGroup);
      return Promise.resolve(value);
    });
    groupTreeRepository.findOne.mockResolvedValue(savedGroup);
    groupMemberRepository.find.mockResolvedValue([]);

    await userContextStorage.run(createUser('current-user-id'), () =>
      service.createGroup({
        name: 'Root Org',
        isOrganization: true,
        addSelfToGroup: true,
      }),
    );

    const createdMember = groupMemberRepository.create.mock.calls[0]?.[0];

    expect(createdMember?.group).toMatchObject({ id: 'saved-group-id' });
    expect(createdMember?.user).toEqual({ id: 'current-user-id' });
    expect(createdMember?.role).toBe(GroupMemberRolesEnum.Member);
  });

  it('should update group data and parent', async () => {
    const { service, groupTreeRepository } = createService();
    const group = createGroup();
    const parent = createGroup({ id: 'parent-id', isOrganization: true });

    groupTreeRepository.findOne
      .mockResolvedValueOnce(group)
      .mockResolvedValueOnce(parent);

    const result = await service.updateGroup('group-id', {
      name: 'Updated',
      parentId: 'parent-id',
    });

    expect(result.name).toBe('Updated');
    expect(result.parent).toBe(parent);
  });

  it('should return empty trees when current user has no groups', async () => {
    const { service, groupTreeRepository } = createService();

    groupTreeRepository.find.mockResolvedValue([]);

    const result = await userContextStorage.run(createUser(), () =>
      service.getGroupTreesByUser(),
    );

    expect(result).toEqual([]);
    expect(groupTreeRepository.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('should build user organization trees in memory', async () => {
    const { service, groupTreeRepository } = createService();
    const root = createGroup({ id: 'root-id', isOrganization: true });
    const child = createGroup({ id: 'child-id', parent: root });
    const queryBuilder = createQueryBuilder();

    groupTreeRepository.find.mockResolvedValue([child]);
    child.organizationGroup = root;
    groupTreeRepository.createQueryBuilder.mockReturnValue(queryBuilder);
    queryBuilder.getMany.mockResolvedValue([root, child]);

    const result = await userContextStorage.run(createUser(), () =>
      service.getGroupTreesByUser(),
    );

    expect(queryBuilder.where).toHaveBeenCalledWith(
      'group.id IN (:...ids) OR org.id IN (:...ids)',
      { ids: ['root-id'] },
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.children).toEqual([child]);
  });

  it('should reject adding members to missing group', async () => {
    const { service, groupTreeRepository } = createService();

    groupTreeRepository.findOne.mockResolvedValue(null);

    await expect(
      service.addGroupMembers('missing-group-id', { members: ['user-id'] }),
    ).rejects.toMatchObject({
      code: GroupExceptionCode.GROUP_NOT_FOUND,
    });
  });

  it('should reject duplicated group members', async () => {
    const { service, groupTreeRepository, groupMemberRepository } =
      createService();

    groupTreeRepository.findOne.mockResolvedValue(createGroup());
    groupMemberRepository.find.mockResolvedValue([createGroupMember()]);

    await expect(
      service.addGroupMembers('group-id', { members: ['user-id'] }),
    ).rejects.toMatchObject({
      code: GroupExceptionCode.USER_ALREADY_IN_GROUP,
    });
    expect(groupMemberRepository.save).not.toHaveBeenCalled();
  });

  it('should promote member to leader in transaction', async () => {
    const { service, groupMemberRepository } = createService();
    const groupMember = createGroupMember({
      role: GroupMemberRolesEnum.Member,
    });

    groupMemberRepository.findOne.mockResolvedValue(groupMember);

    const result = await userContextStorage.run(
      createUser('current-user-id'),
      () =>
        service.updateGroupMember('group-id', 'user-id', {
          role: GroupMemberRolesEnum.Leader,
        }),
    );

    expect(groupMemberRepository.manager.transaction).toHaveBeenCalledTimes(1);
    expect(result.role).toBe(GroupMemberRolesEnum.Leader);
  });

  it('should prevent current leader from demoting self', async () => {
    const { service, groupMemberRepository } = createService();
    const groupMember = createGroupMember({
      user: createUser('current-user-id'),
      role: GroupMemberRolesEnum.Leader,
    });

    groupMemberRepository.findOne.mockResolvedValue(groupMember);

    await userContextStorage.run(createUser('current-user-id'), async () => {
      await expect(
        service.updateGroupMember('group-id', 'current-user-id', {
          role: GroupMemberRolesEnum.Member,
        }),
      ).rejects.toMatchObject({
        code: GroupExceptionCode.CANNOT_UPDATE_SELF_ROLE_TO_MEMBER,
      });
    });
  });

  it('should prevent removing current user from group', async () => {
    const { service, groupMemberRepository } = createService();

    await userContextStorage.run(createUser('current-user-id'), async () => {
      await expect(
        service.removeGroupMember('group-id', 'current-user-id'),
      ).rejects.toMatchObject({
        code: GroupExceptionCode.CANNOT_REMOVE_SELF,
      });
    });
    expect(groupMemberRepository.findOne).not.toHaveBeenCalled();
  });

  it('should prevent removing group leader', async () => {
    const { service, groupMemberRepository } = createService();

    groupMemberRepository.findOne.mockResolvedValue(
      createGroupMember({ role: GroupMemberRolesEnum.Leader }),
    );

    await userContextStorage.run(createUser('current-user-id'), async () => {
      await expect(
        service.removeGroupMember('group-id', 'leader-id'),
      ).rejects.toMatchObject({
        code: GroupExceptionCode.CANNOT_REMOVE_LEADER,
      });
    });
  });

  it('should remove normal group member', async () => {
    const { service, groupMemberRepository } = createService();
    const groupMember = createGroupMember();

    groupMemberRepository.findOne.mockResolvedValue(groupMember);

    const response = await userContextStorage.run(
      createUser('current-user-id'),
      () => service.removeGroupMember('group-id', 'user-id'),
    );

    expect(groupMemberRepository.remove).toHaveBeenCalledWith(groupMember);
    expect(response.message).toBe('Group member removed successfully');
  });
});
