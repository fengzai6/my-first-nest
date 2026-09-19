# 附件管理中心 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增管理员附件管理中心，覆盖附件审计、内容访问、未绑定附件管理、批量操作和清理任务触发。

**Architecture:** 在现有 `attachments` 模块内新增管理控制器、管理服务和查询 DTO，复用现有附件实体、存储接口、清理服务和任务系统。权限通过新增 `attachment:read` / `attachment:manage` 拆分读写；管理员内容访问通过独立 `admin` 签名作用域实现。前端在管理路由下新增附件管理页，并补充基于权限的路由守卫。

**Tech Stack:** NestJS 11、TypeORM、PostgreSQL、class-validator、Swagger、Vitest、React 19、Ant Design 6、TanStack Query、React Router 7、Tailwind CSS 4。

**Spec:** [2026-09-18-attachment-management-center-design.md](../specs/2026-09-18-attachment-management-center-design.md)

## Global Constraints

- 响应统一使用简体中文。
- 文件/目录使用 kebab-case；React 组件使用命名导出。
- 新增权限码固定为 `attachment:read`、`attachment:manage`。
- `admin` 默认拥有两个附件管理权限；`user` 默认不拥有；超级管理员继续通过 `SpecialRolesEnum.SuperAdmin` 绕过 RBAC。
- 本计划不新增附件表字段，不新增附件表，不新增审计表。
- 已绑定附件禁止在管理页修改可见性、软删除或强制解绑。
- 物理删除统一复用 `cleanup-attachments` job，不提供单条立即物理删除。
- 管理员签名作用域固定为 `admin`；普通签名作用域固定为 `user`。
- 管理员签名可以读取已软删除附件；普通签名不能读取已软删除附件。
- `orphanOnly=true` 时忽略 `includeDeleted`，只返回未绑定且未软删除的孤儿附件。
- 批量操作单次最多 100 条，逐条返回成功或失败结果，部分失败不回滚其他成功项。
- `storageKey` 和物理路径不得出现在任何 API 响应中。
- 前端权限隐藏只用于体验优化，后端必须独立执行权限校验。
- 本计划不执行 `git add`、`git commit`、`git push`、建分支或开 PR。

---

## File Structure

**服务端新增**

- `apps/server/src/common/constants/permissions/attachments.permission.ts`：附件管理权限定义。
- `apps/server/src/modules/attachments/dto/find-management-attachments.dto.ts`：管理列表筛选 DTO。
- `apps/server/src/modules/attachments/dto/update-management-visibility.dto.ts`：单条可见性修改 DTO。
- `apps/server/src/modules/attachments/dto/bulk-visibility.dto.ts`：批量可见性 DTO。
- `apps/server/src/modules/attachments/dto/bulk-soft-delete.dto.ts`：批量软删除 DTO。
- `apps/server/src/modules/attachments/services/attachment-management.service.ts`：管理查询、写操作、批量操作和清理触发。
- `apps/server/src/modules/attachments/attachments-management.controller.ts`：管理接口路由和权限装饰器。
- `apps/server/tests/unit/modules/attachments/attachment-management.service.spec.ts`：管理服务单元测试。
- `apps/server/tests/unit/modules/attachments/attachments-management.controller.spec.ts`：管理控制器单元测试。
- `apps/server/tests/e2e/attachments-management.e2e-spec.ts`：管理接口 E2E 测试。

**服务端修改**

- `apps/server/src/common/constants/permissions/index.ts`：合并并导出附件权限。
- `apps/server/src/common/constants/roles.ts`：`admin` 默认拥有附件管理权限，`user` 不授予。
- `apps/server/src/modules/attachments/attachment-signature.service.ts`：签名增加 `scope`。
- `apps/server/src/modules/attachments/dto/content-attachment.dto.ts`：增加 `scope` 查询参数。
- `apps/server/src/modules/attachments/attachments.service.ts`：内容读取区分 `user` / `admin` scope，已软删除读取规则。
- `apps/server/src/modules/attachments/attachments.controller.ts`：内容接口传递 `scope`。
- `apps/server/src/modules/attachments/attachments.module.ts`：注册管理控制器和管理服务。
- `apps/server/src/modules/background-tasks/background-tasks.controller.ts`：清理附件接口增加权限和去重。
- `apps/server/src/common/exceptions/attachment.exception.ts`：增加清理任务冲突和非法状态错误码。
- `apps/server/src/modules/attachments/README.md`：补充管理入口、签名作用域和管理规则。

**前端新增**

- `apps/web/src/services/types/attachment-management.ts`：管理列表、详情和批量结果类型。
- `apps/web/src/services/dtos/attachment-management.ts`：管理查询和批量操作 DTO。
- `apps/web/src/services/api/attachment-management.ts`：管理 API。
- `apps/web/src/pages/management/attachments/index.tsx`：附件管理页面。
- `apps/web/src/pages/management/attachments/components/attachment-detail-drawer.tsx`：附件详情 Drawer。
- `apps/web/src/pages/management/attachments/components/attachment-filters.tsx`：筛选区。
- `apps/web/src/pages/management/attachments/components/attachment-cleanup-card.tsx`：最近清理结果卡片。
- `apps/web/src/pages/management/attachments/components/attachment-bulk-actions.tsx`：批量操作栏。
- `apps/web/src/pages/management/attachments/components/attachment-actions.tsx`：行操作。
- `apps/web/src/router/permission-guard.tsx`：基于权限的路由守卫。
- `apps/web/src/components/root/user-permission-context.ts`：用户权限 Context。
- `apps/web/src/components/root/user-permission-provider.tsx`：加载当前用户权限并缓存。

**前端修改**

- `apps/web/src/router/routes.tsx`：新增 `/management/attachments` 路由和权限守卫。
- `apps/web/src/components/app-sidebar/index.tsx`：新增“附件管理”菜单。
- `apps/web/src/components/root/index.tsx`：挂载用户权限 Provider。
- `apps/web/src/components/data-table/index.tsx`：支持 `rowSelection` 透传。
- `apps/web/src/services/types/user.ts`：定义 `ATTACHMENT_MANAGEMENT_PERMISSIONS` 常量。

**测试新增或修改**

- `apps/server/tests/unit/modules/attachments/attachment-signature.service.spec.ts`
- `apps/server/tests/unit/modules/attachments/attachments.service.spec.ts`
- `apps/server/tests/unit/modules/background-tasks/cleanup-attachments.controller.spec.ts`（新建）
- `apps/web/src/router/permission-guard.test.ts`
- `apps/web/src/services/api/__tests__/attachment-management.test.ts`

---

### Task 1: 附件管理权限与角色分配

**Files:**

- Create: `apps/server/src/common/constants/permissions/attachments.permission.ts`
- Modify: `apps/server/src/common/constants/permissions/index.ts`
- Modify: `apps/server/src/common/constants/roles.ts`
- Test: `apps/server/tests/e2e/attachments-management.e2e-spec.ts`

**Interfaces:**

- Consumes: `CreatePermissionDto`、`PERMISSIONS`、`DEFAULT_ROLES`。
- Produces: `AttachmentsPermissionCode`、`ATTACHMENTS_PERMISSIONS`、`PermissionCode.ATTACHMENT_READ`、`PermissionCode.ATTACHMENT_MANAGE`。

创建 `attachments.permission.ts`：

```ts
import { CreatePermissionDto } from "@/modules/permissions/dto/create-permission.dto";

export const AttachmentsPermissionCode = {
  ATTACHMENT_READ: "attachment:read",
  ATTACHMENT_MANAGE: "attachment:manage",
} as const;

export const ATTACHMENTS_PERMISSIONS: CreatePermissionDto[] = [
  {
    name: "读取附件管理信息",
    code: AttachmentsPermissionCode.ATTACHMENT_READ,
  },
  {
    name: "管理附件",
    code: AttachmentsPermissionCode.ATTACHMENT_MANAGE,
  },
];
```

- [ ] **Step 1: 写失败测试**

在 `apps/server/tests/e2e/attachments-management.e2e-spec.ts` 创建测试骨架：

```ts
import { RoleCode } from "@/common/constants/roles";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { TestHelper } from "./helpers/test-helper";

describe("Attachments management permissions (e2e)", () => {
  let helper: TestHelper;
  let userAccessToken: string;
  let adminAccessToken: string;

  beforeAll(async () => {
    helper = new TestHelper();
    await helper.init();
  });

  afterAll(async () => {
    await helper.close();
  });

  beforeEach(async () => {
    await helper.cleanDatabase();
    await helper.seedDatabase();

    userAccessToken = (
      await helper.signupAndLogin({
        username: "attachment-user",
        email: "attachment-user@example.com",
        password: "password123",
        roles: [RoleCode.USER],
      })
    ).accessToken;

    adminAccessToken = (
      await helper.signupAndLogin({
        username: "attachment-admin",
        email: "attachment-admin@example.com",
        password: "password123",
        roles: [RoleCode.ADMIN],
      })
    ).accessToken;
  });

  it("grants attachment management permissions to admin", async () => {
    const response = await request(helper.getHttpServer())
      .get("/api/account/permissions")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);

    expect(
      response.body.map((permission: { code: string }) => permission.code)
    ).toEqual(expect.arrayContaining(["attachment:read", "attachment:manage"]));
  });

  it("does not grant attachment management permissions to a normal user", async () => {
    const response = await request(helper.getHttpServer())
      .get("/api/account/permissions")
      .set("Authorization", `Bearer ${userAccessToken}`)
      .expect(200);

    expect(
      response.body.map((permission: { code: string }) => permission.code)
    ).not.toEqual(
      expect.arrayContaining(["attachment:read", "attachment:manage"])
    );
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
yarn workspace @my-first-nest/server test:e2e tests/e2e/attachments-management.e2e-spec.ts
```

Expected: 权限断言失败，新增权限尚未定义和分配。

- [ ] **Step 3: 实现权限定义和角色分配**

创建 `apps/server/src/common/constants/permissions/attachments.permission.ts`，内容使用上方接口定义。

修改 `apps/server/src/common/constants/permissions/index.ts`：

```ts
import {
  ATTACHMENTS_PERMISSIONS,
  AttachmentsPermissionCode,
} from "./attachments.permission";

export const PermissionCode = {
  ...UsersPermissionCode,
  ...CatsPermissionCode,
  ...RolesPermissionCode,
  ...GroupsPermissionCode,
  ...PermissionsPermissionCode,
  ...DocumentsPermissionCode,
  ...AttachmentsPermissionCode,
} as const;

export const PERMISSIONS = [
  ...USERS_PERMISSIONS,
  ...CATS_PERMISSIONS,
  ...ROLES_PERMISSIONS,
  ...GROUPS_PERMISSIONS,
  ...PERMISSIONS_PERMISSIONS,
  ...DOCUMENTS_PERMISSIONS,
  ...ATTACHMENTS_PERMISSIONS,
];
```

修改 `apps/server/src/common/constants/roles.ts`，让 `admin` 通过 `PERMISSIONS` 自动获得新权限；`user` 的权限保持：

```ts
permissions: [...USERS_PERMISSIONS, ...DOCUMENTS_PERMISSIONS],
```

无需把 `ATTACHMENTS_PERMISSIONS` 加入 `user`。

- [ ] **Step 4: 运行测试确认通过**

Run:

```bash
yarn workspace @my-first-nest/server test:e2e tests/e2e/attachments-management.e2e-spec.ts
```

Expected: 2 个用例通过，证明 `admin` 已获得新增权限，普通用户未获得新增权限。

- [ ] **Step 5: 验证权限种子**

Run:

```bash
yarn workspace @my-first-nest/server db:seed
```

Expected: 命令成功，新增两个权限并同步到 `admin` 角色。

---

### Task 2: 管理列表查询 DTO 和查询服务

**Files:**

- Create: `apps/server/src/modules/attachments/dto/find-management-attachments.dto.ts`
- Create: `apps/server/src/modules/attachments/services/attachment-management.service.ts`
- Modify: `apps/server/src/modules/attachments/attachments.module.ts`
- Modify: `apps/server/src/common/exceptions/attachment.exception.ts`
- Test: `apps/server/tests/unit/modules/attachments/attachment-management.service.spec.ts`

**Interfaces:**

- Consumes: `Attachment`、`Repository<Attachment>`、`ATTACHMENT_BIZ_TYPE`、`ATTACHMENT_VISIBILITY`、清理保留期。
- Produces:

```ts
interface IAttachmentManagementItem {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  visibility: AttachmentVisibility;
  storageProvider: string;
  bizType: string | null;
  bizId: string | null;
  uploadedBy: { id: string; displayName: string };
  status: "bound" | "orphan" | "deleted";
  cleanupStatus: "not_candidate" | "waiting" | "eligible";
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

interface IAttachmentManagementPage {
  list: IAttachmentManagementItem[];
  total: number;
  page: number;
  pageSize: number;
}
```

- [ ] **Step 1: 写失败测试**

创建 `attachment-management.service.spec.ts`，用 mocked repository 写以下用例：

```ts
it("filters deleted attachments only when includeDeleted is true", async () => {
  const { queryBuilder, service } = createManagementService();

  await service.findAll({});

  expect(queryBuilder.withDeleted).not.toHaveBeenCalled();
});

it("treats orphanOnly as excluding deleted attachments", async () => {
  const { queryBuilder, service } = createManagementService();

  await service.findAll({ orphanOnly: true, includeDeleted: true });

  expect(queryBuilder.withDeleted).not.toHaveBeenCalled();
  expect(queryBuilder.andWhere).toHaveBeenCalledWith(
    "attachment.bizType IS NULL"
  );
  expect(queryBuilder.andWhere).toHaveBeenCalledWith(
    "attachment.bizId IS NULL"
  );
});

it("derives eligible cleanup status from retention cutoff", async () => {
  const { repository, service } = createManagementService();
  const attachment = createAttachment({
    deletedAt: new Date("2026-09-01T00:00:00.000Z"),
  });
  repository.createQueryBuilder.mockReturnValue({
    ...createQueryBuilder(),
    getManyAndCount: vi.fn().mockResolvedValue([[attachment], 1]),
  });

  const result = await service.findAll(
    {},
    new Date("2026-09-18T00:00:00.000Z")
  );

  expect(result.list[0].cleanupStatus).toBe("eligible");
});
```

`createManagementService()` 必须注入：

```ts
new AttachmentManagementService(
  repository as never,
  signatureService as never,
  jobService as never,
  configService as never,
  logger as never
);
```

`AttachmentManagementService` 的构造函数固定为：

```ts
import { getConfig } from '@/config/configuration';
import { LoggerService } from '@/shared/log/logger.service';
import { JobService } from '@/shared/jobs/services/job.service';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AttachmentSignatureService } from '../attachment-signature.service';
import { Attachment } from '../entities/attachment.entity';

constructor(
  @InjectRepository(Attachment)
  private readonly attachmentRepository: Repository<Attachment>,
  private readonly signatureService: AttachmentSignatureService,
  private readonly jobService: JobService,
  configService: ConfigService,
  private readonly logger: LoggerService,
) {
  this.retentionDays = getConfig(configService).upload.cleanupRetentionDays;
}

private readonly retentionDays: number;
```

`createManagementService()` 中的 mocked repository 必须至少提供：

```ts
const repository = {
  createQueryBuilder: vi.fn(),
  findOne: vi.fn(),
  save: vi.fn(),
  softRemove: vi.fn(),
};
const signatureService = {
  createSignedUrl: vi.fn(),
};
const jobService = {
  hasActiveOrPending: vi.fn(),
  submit: vi.fn(),
  list: vi.fn(),
};
const configService = {
  get: vi.fn((key: string) => {
    if (key === "default") {
      return { upload: { cleanupRetentionDays: 30 } };
    }
    return {};
  }),
};
const logger = {
  log: vi.fn(),
};

const createManagementService = () =>
  new AttachmentManagementService(
    repository as never,
    signatureService as never,
    jobService as never,
    configService as never,
    logger as never
  );
```

也可以把这些 mock 声明在 `beforeEach` 中并在每个用例重新赋值。至少必须提供：

```ts
createQueryBuilder: vi.fn(),
findOne: vi.fn(),
save: vi.fn(),
softRemove: vi.fn(),
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
yarn workspace @my-first-nest/server test tests/unit/modules/attachments/attachment-management.service.spec.ts
```

Expected: 测试文件因 `AttachmentManagementService` 不存在而失败。

- [ ] **Step 3: 新增 DTO**

创建 `find-management-attachments.dto.ts`：

```ts
import { ATTACHMENT_VISIBILITY } from "../constants/attachment.constants";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

const VISIBILITY_VALUES = Object.values(ATTACHMENT_VISIBILITY);

export class FindManagementAttachmentsDto {
  @ApiPropertyOptional({ description: "页码，从 1 开始", example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: "每页数量，最大 100", example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;

  @ApiPropertyOptional({ description: "按原始文件名模糊搜索" })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  keyword?: string;

  @ApiPropertyOptional({ description: "MIME 类型" })
  @IsOptional()
  @IsString()
  @MaxLength(127)
  mimeType?: string;

  @ApiPropertyOptional({ enum: VISIBILITY_VALUES })
  @IsOptional()
  @IsIn(VISIBILITY_VALUES)
  visibility?: (typeof ATTACHMENT_VISIBILITY)[keyof typeof ATTACHMENT_VISIBILITY];

  @ApiPropertyOptional({ description: "业务类型" })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  bizType?: string;

  @ApiPropertyOptional({ description: "业务 ID" })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  bizId?: string;

  @ApiPropertyOptional({ description: "上传人用户名或显示名" })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  uploader?: string;

  @ApiPropertyOptional({ description: "是否包含已软删除附件" })
  @IsOptional()
  @Transform(({ value }) => value === true || value === "true")
  @IsBoolean()
  includeDeleted?: boolean = false;

  @ApiPropertyOptional({ description: "是否只查询未绑定孤儿附件" })
  @IsOptional()
  @Transform(({ value }) => value === true || value === "true")
  @IsBoolean()
  orphanOnly?: boolean = false;

  @ApiPropertyOptional({ description: "创建时间下限" })
  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @ApiPropertyOptional({ description: "创建时间上限" })
  @IsOptional()
  @IsDateString()
  createdTo?: string;
}
```

- [ ] **Step 4: 实现管理查询服务**

创建 `attachment-management.service.ts`。核心查询实现必须满足：

```ts
async findAll(
  query: FindManagementAttachmentsDto,
  now = new Date(),
): Promise<IAttachmentManagementPage> {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  const cutoff = new Date(
    now.getTime() - this.retentionDays * 24 * 60 * 60 * 1000,
  );
  const builder = this.attachmentRepository
    .createQueryBuilder('attachment')
    .leftJoinAndSelect('attachment.uploadedBy', 'uploadedBy');

  if (!query.orphanOnly && query.includeDeleted) {
    builder.withDeleted();
  }
  if (query.orphanOnly) {
    builder
      .andWhere('attachment.bizType IS NULL')
      .andWhere('attachment.bizId IS NULL')
      .andWhere('attachment.deletedAt IS NULL');
  }
  if (query.keyword) {
    builder.andWhere('attachment.originalName ILIKE :keyword', {
      keyword: `%${query.keyword}%`,
    });
  }
  if (query.mimeType) {
    builder.andWhere('attachment.mimeType = :mimeType', {
      mimeType: query.mimeType,
    });
  }
  if (query.visibility) {
    builder.andWhere('attachment.visibility = :visibility', {
      visibility: query.visibility,
    });
  }
  if (query.bizType) {
    builder.andWhere('attachment.bizType = :bizType', {
      bizType: query.bizType,
    });
  }
  if (query.bizId) {
    builder.andWhere('attachment.bizId = :bizId', {
      bizId: query.bizId,
    });
  }
  if (query.uploader) {
    builder.andWhere(
      '(uploadedBy.username ILIKE :uploader OR uploadedBy.displayName ILIKE :uploader)',
      { uploader: `%${query.uploader}%` },
    );
  }
  if (query.createdFrom) {
    builder.andWhere('attachment.createdAt >= :createdFrom', {
      createdFrom: query.createdFrom,
    });
  }
  if (query.createdTo) {
    builder.andWhere('attachment.createdAt <= :createdTo', {
      createdTo: query.createdTo,
    });
  }

  const [items, total] = await builder
    .orderBy('attachment.createdAt', 'DESC')
    .addOrderBy('attachment.id', 'DESC')
    .skip((page - 1) * pageSize)
    .take(pageSize)
    .getManyAndCount();

  return {
    list: items.map((item) => this.toManagementItem(item, cutoff)),
    total,
    page,
    pageSize,
  };
}
```

派生状态必须按以下规则实现：

```ts
private getAttachmentStatus(attachment: Attachment) {
  if (attachment.deletedAt) return 'deleted';
  if (attachment.bizType && attachment.bizId) return 'bound';
  return 'orphan';
}

private getCleanupStatus(
  attachment: Attachment,
  cutoff: Date,
) {
  if (attachment.bizType || attachment.bizId) return 'not_candidate';
  if (attachment.deletedAt) {
    return attachment.deletedAt <= cutoff ? 'eligible' : 'waiting';
  }
  return attachment.createdAt <= cutoff ? 'eligible' : 'waiting';
}
```

`toManagementItem()` 只返回 spec 定义的字段，不返回 `storageKey`。

- [ ] **Step 5: 注册 Provider**

修改 `apps/server/src/modules/attachments/attachments.module.ts`：

```ts
import { AttachmentManagementService } from './services/attachment-management.service';

providers: [
  AttachmentsService,
  AttachmentManagementService,
  // ...现有 providers
],
exports: [AttachmentsService, AttachmentManagementService],
```

- [ ] **Step 6: 运行测试确认通过**

Run:

```bash
yarn workspace @my-first-nest/server test tests/unit/modules/attachments/attachment-management.service.spec.ts
```

Expected: 测试通过。

---

### Task 3: 管理员签名作用域

**Files:**

- Modify: `apps/server/src/modules/attachments/attachment-signature.service.ts`
- Modify: `apps/server/src/modules/attachments/dto/content-attachment.dto.ts`
- Modify: `apps/server/src/modules/attachments/attachments.service.ts`
- Modify: `apps/server/src/modules/attachments/attachments.controller.ts`
- Test: `apps/server/tests/unit/modules/attachments/attachment-signature.service.spec.ts`
- Test: `apps/server/tests/unit/modules/attachments/attachments.service.spec.ts`

**Interfaces:**

- Produces:

```ts
type AttachmentSignatureScope = 'user' | 'admin';

createSignedUrl(
  attachmentId: string,
  userId: string,
  scope?: AttachmentSignatureScope,
): { url: string; expiresAt: number };

verifySignature(
  attachmentId: string,
  userId: string,
  expiresAt: number,
  signature: string,
  scope?: AttachmentSignatureScope,
): boolean;
```

URL 必须包含 `scope`，默认 `user`。

- [ ] **Step 1: 写失败测试**

在 `attachment-signature.service.spec.ts` 增加：

```ts
it("creates an admin scoped signature that cannot be verified as user scope", () => {
  const service = createService();
  const { url } = service.createSignedUrl("attachment-id", "admin-id", "admin");
  const parsed = new URL(url, "http://localhost");

  expect(parsed.searchParams.get("scope")).toBe("admin");
  expect(
    service.verifySignature(
      "attachment-id",
      "admin-id",
      Number(parsed.searchParams.get("expiresAt")),
      parsed.searchParams.get("signature") ?? "",
      "user"
    )
  ).toBe(false);
  expect(
    service.verifySignature(
      "attachment-id",
      "admin-id",
      Number(parsed.searchParams.get("expiresAt")),
      parsed.searchParams.get("signature") ?? "",
      "admin"
    )
  ).toBe(true);
});

it("rejects scope tampering", () => {
  const service = createService();
  const { url } = service.createSignedUrl("attachment-id", "user-id", "user");
  const parsed = new URL(url, "http://localhost");

  expect(
    service.verifySignature(
      "attachment-id",
      "user-id",
      Number(parsed.searchParams.get("expiresAt")),
      parsed.searchParams.get("signature") ?? "",
      "admin"
    )
  ).toBe(false);
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
yarn workspace @my-first-nest/server test tests/unit/modules/attachments/attachment-signature.service.spec.ts
```

Expected: 签名方法不支持 scope，测试失败。

- [ ] **Step 3: 实现签名作用域**

修改 `AttachmentSignatureService`：

```ts
export const ATTACHMENT_SIGNATURE_SCOPE = {
  USER: "user",
  ADMIN: "admin",
} as const;

export type AttachmentSignatureScope =
  (typeof ATTACHMENT_SIGNATURE_SCOPE)[keyof typeof ATTACHMENT_SIGNATURE_SCOPE];
```

`createSignedUrl` 默认 `USER`，把 `scope` 加入 `URLSearchParams`，并把 `scope` 加入 HMAC 的签名字符串：

```ts
.update(`${attachmentId}.${userId}.${expiresAt}.${scope}`)
```

`verifySignature` 默认 `USER`，签名时使用同样载荷。

- [ ] **Step 4: 写内容读取失败测试**

在 `attachments.service.spec.ts` 增加：

```ts
it("allows admin scope to read a deleted attachment", async () => {
  const { service, repository, verifySignature } = createService();
  const attachment = createAttachment({
    deletedAt: new Date("2026-09-01T00:00:00.000Z"),
  });
  repository.findOne.mockResolvedValue(attachment);
  verifySignature.mockReturnValue(true);

  await expect(
    service.getContent(
      attachment.id,
      String(Date.now() + 300_000),
      "admin-id",
      "signature",
      "admin"
    )
  ).resolves.toMatchObject({ attachment });
});

it("rejects user scope for a deleted attachment", async () => {
  const { service, repository } = createService();
  repository.findOne.mockResolvedValue(
    createAttachment({ deletedAt: new Date("2026-09-01T00:00:00.000Z") })
  );

  await expect(
    service.getContent(
      "attachment-id",
      String(Date.now() + 300_000),
      "user-id",
      "signature",
      "user"
    )
  ).rejects.toMatchObject({ code: AttachmentExceptionCode.NOT_FOUND });
});
```

- [ ] **Step 5: 实现内容读取作用域**

修改 `AttachmentsService.findOne()` 支持 `withDeleted`：

```ts
async findOne(
  id: string,
  manager?: EntityManager,
  withDeleted = false,
): Promise<Attachment> {
  const repository =
    manager?.getRepository(Attachment) ?? this.attachmentRepository;
  const attachment = await repository.findOne({
    where: { id },
    relations: { uploadedBy: true },
    withDeleted,
  });

  if (!attachment) {
    throw new AttachmentException(AttachmentExceptionCode.NOT_FOUND);
  }

  return attachment;
}
```

`getContent()` 增加 `scope` 参数，默认 `user`：

- `scope='user'` 使用 `withDeleted=false`，已软删除附件按不存在处理。
- `scope='admin'` 使用 `withDeleted=true`。
- 公开附件路径保持不变。
- 私有附件校验签名时传入 scope。

- [ ] **Step 6: 更新控制器和内容 DTO**

`ContentAttachmentDto` 增加：

```ts
@ApiPropertyOptional({
  description: '签名作用域：user 或 admin，默认 user',
  enum: ['user', 'admin'],
})
@IsOptional()
@IsIn(['user', 'admin'])
scope?: 'user' | 'admin' = 'user';
```

控制器调用：

```ts
const { attachment, content } = await this.attachmentsService.getContent(
  id,
  query.expiresAt,
  query.userId,
  query.signature,
  query.scope
);
```

同时更新 `apps/server/tests/unit/modules/attachments/attachments.controller.spec.ts`
中现有 `controller.getContent(...)` 调用，显式传入 `scope` 参数，并断言
`AttachmentsService.getContent` 收到该 scope。

- [ ] **Step 7: 运行测试确认通过**

Run:

```bash
yarn workspace @my-first-nest/server test tests/unit/modules/attachments/attachment-signature.service.spec.ts
yarn workspace @my-first-nest/server test tests/unit/modules/attachments/attachments.service.spec.ts
yarn workspace @my-first-nest/server test tests/unit/modules/attachments/attachments.controller.spec.ts
```

Expected: 全部通过。

---

### Task 4: 管理查询和详情接口

**Files:**

- Create: `apps/server/src/modules/attachments/attachments-management.controller.ts`
- Modify: `apps/server/src/modules/attachments/services/attachment-management.service.ts`
- Modify: `apps/server/src/modules/attachments/attachments.module.ts`
- Test: `apps/server/tests/unit/modules/attachments/attachments-management.controller.spec.ts`
- Test: `apps/server/tests/e2e/attachments-management.e2e-spec.ts`

**Interfaces:**

- Produces:

```ts
findAll(
  query: FindManagementAttachmentsDto,
  now?: Date,
): Promise<IAttachmentManagementPage>;

findOne(id: string): Promise<IAttachmentManagementDetail>;

createSignedUrl(
  id: string,
  user: User,
): Promise<{ url: string; expiresAt: number }>;
```

- [ ] **Step 1: 写控制器失败测试**

创建 `attachments-management.controller.spec.ts`：

```ts
it("delegates list queries to the management service", async () => {
  const service = {
    findAll: vi.fn().mockResolvedValue({
      list: [],
      total: 0,
      page: 1,
      pageSize: 20,
    }),
  } as unknown as AttachmentManagementService;
  const controller = new AttachmentsManagementController(service);

  await controller.findAll({ page: 1, pageSize: 20 });

  expect(service.findAll).toHaveBeenCalledWith({ page: 1, pageSize: 20 });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
yarn workspace @my-first-nest/server test tests/unit/modules/attachments/attachments-management.controller.spec.ts
```

Expected: 控制器不存在，测试失败。

- [ ] **Step 3: 实现详情和签名服务方法**

在 `AttachmentManagementService` 增加：

```ts
async findOne(id: string): Promise<IAttachmentManagementDetail> {
  const attachment = await this.attachmentRepository.findOne({
    where: { id },
    relations: { uploadedBy: true },
    withDeleted: true,
  });

  if (!attachment) {
    throw new AttachmentException(AttachmentExceptionCode.NOT_FOUND);
  }

  return {
    ...this.toManagementItem(attachment, this.getRetentionCutoff()),
    retentionDeadline: this.getRetentionDeadline(attachment),
  };
}

async createSignedUrl(
  id: string,
  user: User,
): Promise<{ url: string; expiresAt: number }> {
  await this.findOne(id);
  return this.signatureService.createSignedUrl(id, user.id, 'admin');
}
```

`retentionDeadline` 规则：

- 已软删除附件：`deletedAt + retentionDays`
- 孤儿附件：`createdAt + retentionDays`
- 已绑定附件：`null`

- [ ] **Step 4: 实现管理控制器**

创建 `attachments-management.controller.ts`：

```ts
import { PermissionCode } from "@/common/constants/permissions";
import { UserInfo } from "@/common/decorators/jwt-auth.decorator";
import { Permission } from "@/common/decorators/permission.decorator";
import { User } from "@/modules/users/entities/user.entity";
import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { FindManagementAttachmentsDto } from "./dto/find-management-attachments.dto";
import { AttachmentManagementService } from "./services/attachment-management.service";

@ApiTags("Attachments Management - 附件管理")
@ApiBearerAuth()
@Controller("attachments/management")
export class AttachmentsManagementController {
  constructor(
    private readonly attachmentManagementService: AttachmentManagementService
  ) {}

  @Get()
  @Permission(PermissionCode.ATTACHMENT_READ)
  @ApiOperation({ summary: "分页查询附件管理列表" })
  findAll(@Query() query: FindManagementAttachmentsDto) {
    return this.attachmentManagementService.findAll(query);
  }

  @Get(":id")
  @Permission(PermissionCode.ATTACHMENT_READ)
  @ApiOperation({ summary: "查询附件管理详情" })
  findOne(@Param("id") id: string) {
    return this.attachmentManagementService.findOne(id);
  }

  @Get(":id/signed-url")
  @Permission(PermissionCode.ATTACHMENT_READ)
  @ApiOperation({ summary: "获取管理员附件签名 URL" })
  getSignedUrl(@Param("id") id: string, @UserInfo() user: User) {
    return this.attachmentManagementService.createSignedUrl(id, user);
  }
}
```

- [ ] **Step 5: 注册控制器**

修改 `attachments.module.ts`：

```ts
controllers: [AttachmentsController, AttachmentsManagementController],
```

- [ ] **Step 6: 运行测试确认通过**

Run:

```bash
yarn workspace @my-first-nest/server test tests/unit/modules/attachments/attachments-management.controller.spec.ts
yarn workspace @my-first-nest/server test:e2e tests/e2e/attachments-management.e2e-spec.ts
```

Expected: 控制器单测通过；E2E 中管理员列表已可 200，普通用户仍 403。

---

### Task 5: 单条和批量写操作

**Files:**

- Create: `apps/server/src/modules/attachments/dto/update-management-visibility.dto.ts`
- Create: `apps/server/src/modules/attachments/dto/bulk-visibility.dto.ts`
- Create: `apps/server/src/modules/attachments/dto/bulk-soft-delete.dto.ts`
- Modify: `apps/server/src/modules/attachments/services/attachment-management.service.ts`
- Modify: `apps/server/src/modules/attachments/attachments-management.controller.ts`
- Modify: `apps/server/src/common/exceptions/attachment.exception.ts`
- Test: `apps/server/tests/unit/modules/attachments/attachment-management.service.spec.ts`
- Test: `apps/server/tests/e2e/attachments-management.e2e-spec.ts`

**Interfaces:**

- Produces:

```ts
updateVisibility(id: string, visibility: AttachmentVisibility): Promise<IAttachmentManagementItem>;
softDelete(id: string): Promise<void>;
bulkUpdateVisibility(
  ids: string[],
  visibility: AttachmentVisibility,
): Promise<IAttachmentBulkResult>;
bulkSoftDelete(ids: string[]): Promise<IAttachmentBulkResult>;
```

```ts
interface IAttachmentBulkResult {
  succeeded: string[];
  failed: { id: string; reason: string }[];
}
```

- [ ] **Step 1: 写失败测试**

在 `attachment-management.service.spec.ts` 增加：

```ts
it("rejects visibility updates for bound attachments", async () => {
  const { repository, service } = createManagementService();
  repository.findOne.mockResolvedValue(
    createAttachment({ bizType: "document", bizId: "document-id" })
  );

  await expect(
    service.updateVisibility("attachment-id", ATTACHMENT_VISIBILITY.PUBLIC)
  ).rejects.toMatchObject({ code: AttachmentExceptionCode.IN_USE });
});

it("updates visibility for orphan attachments", async () => {
  const { repository, service } = createManagementService();
  const attachment = createAttachment();
  repository.findOne.mockResolvedValue(attachment);
  repository.save.mockImplementation(async (value) => value);

  const result = await service.updateVisibility(
    "attachment-id",
    ATTACHMENT_VISIBILITY.PUBLIC
  );

  expect(result.visibility).toBe(ATTACHMENT_VISIBILITY.PUBLIC);
});

it("returns per-item failures for bulk operations", async () => {
  const { repository, service } = createManagementService();
  repository.findOne
    .mockResolvedValueOnce(createAttachment())
    .mockResolvedValueOnce(
      createAttachment({ bizType: "document", bizId: "document-id" })
    );

  const result = await service.bulkSoftDelete(["a", "b"]);

  expect(result.succeeded).toEqual(["a"]);
  expect(result.failed).toEqual([
    { id: "b", reason: "已绑定的附件不能通过通用接口修改或删除" },
  ]);
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
yarn workspace @my-first-nest/server test tests/unit/modules/attachments/attachment-management.service.spec.ts
```

Expected: 写方法不存在，测试失败。

- [ ] **Step 3: 新增 DTO**

`update-management-visibility.dto.ts`：

```ts
import { ATTACHMENT_VISIBILITY } from "../constants/attachment.constants";
import { ApiProperty } from "@nestjs/swagger";
import { IsIn } from "class-validator";

export class UpdateManagementVisibilityDto {
  @ApiProperty({ enum: Object.values(ATTACHMENT_VISIBILITY) })
  @IsIn(Object.values(ATTACHMENT_VISIBILITY))
  visibility: "private" | "public";
}
```

`bulk-visibility.dto.ts`：

```ts
import { ATTACHMENT_VISIBILITY } from "../constants/attachment.constants";
import { ApiProperty } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsString,
} from "class-validator";

export class BulkVisibilityDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  ids: string[];

  @ApiProperty({ enum: Object.values(ATTACHMENT_VISIBILITY) })
  @IsIn(Object.values(ATTACHMENT_VISIBILITY))
  visibility: "private" | "public";
}
```

`bulk-soft-delete.dto.ts`：

```ts
import { ApiProperty } from "@nestjs/swagger";
import { ArrayMaxSize, ArrayUnique, IsArray, IsString } from "class-validator";

export class BulkSoftDeleteDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  ids: string[];
}
```

- [ ] **Step 4: 实现单条写操作**

在 `AttachmentManagementService` 增加：

```ts
async updateVisibility(
  id: string,
  visibility: AttachmentVisibility,
): Promise<IAttachmentManagementItem> {
  const attachment = await this.getMutableAttachment(id);
  const before = attachment.visibility;
  attachment.visibility = visibility;
  const saved = await this.attachmentRepository.save(attachment);
  this.logger.log('Attachment visibility updated', {
    category: LOG_CATEGORY.BUSINESS,
    context: { attachmentId: id, before, after: visibility },
  });
  return this.toManagementItem(saved, this.getRetentionCutoff());
}

async softDelete(id: string): Promise<void> {
  const attachment = await this.getMutableAttachment(id);
  await this.attachmentRepository.softRemove(attachment);
  this.logger.log('Attachment soft deleted from management center', {
    category: LOG_CATEGORY.BUSINESS,
    context: { attachmentId: id },
  });
}

private async getMutableAttachment(id: string): Promise<Attachment> {
  const attachment = await this.attachmentRepository.findOne({
    where: { id },
    relations: { uploadedBy: true },
  });

  if (!attachment) {
    throw new AttachmentException(AttachmentExceptionCode.NOT_FOUND);
  }
  if (attachment.bizType || attachment.bizId) {
    throw new AttachmentException(AttachmentExceptionCode.IN_USE);
  }

  return attachment;
}
```

- [ ] **Step 5: 实现批量操作**

批量操作必须逐条捕获异常并返回结果：

```ts
async bulkUpdateVisibility(
  ids: string[],
  visibility: AttachmentVisibility,
): Promise<IAttachmentBulkResult> {
  return this.runBulk(ids, (id) => this.updateVisibility(id, visibility));
}

async bulkSoftDelete(ids: string[]): Promise<IAttachmentBulkResult> {
  return this.runBulk(ids, (id) => this.softDelete(id));
}

private async runBulk(
  ids: string[],
  action: (id: string) => Promise<unknown>,
): Promise<IAttachmentBulkResult> {
  const result: IAttachmentBulkResult = { succeeded: [], failed: [] };

  for (const id of ids) {
    try {
      await action(id);
      result.succeeded.push(id);
    } catch (error) {
      result.failed.push({
        id,
        reason: error instanceof Error ? error.message : '操作失败',
      });
    }
  }

  return result;
}
```

- [ ] **Step 6: 增加控制器路由**

在 `AttachmentsManagementController` 增加：

```ts
@Patch(':id/visibility')
@Permission(PermissionCode.ATTACHMENT_MANAGE)
updateVisibility(
  @Param('id') id: string,
  @Body() dto: UpdateManagementVisibilityDto,
) {
  return this.attachmentManagementService.updateVisibility(
    id,
    dto.visibility,
  );
}

@Post(':id/soft-delete')
@HttpCode(HttpStatus.OK)
@Permission(PermissionCode.ATTACHMENT_MANAGE)
async softDelete(@Param('id') id: string) {
  await this.attachmentManagementService.softDelete(id);
}

@Patch('bulk/visibility')
@Permission(PermissionCode.ATTACHMENT_MANAGE)
bulkUpdateVisibility(@Body() dto: BulkVisibilityDto) {
  return this.attachmentManagementService.bulkUpdateVisibility(
    dto.ids,
    dto.visibility,
  );
}

@Post('bulk/soft-delete')
@HttpCode(HttpStatus.OK)
@Permission(PermissionCode.ATTACHMENT_MANAGE)
bulkSoftDelete(@Body() dto: BulkSoftDeleteDto) {
  return this.attachmentManagementService.bulkSoftDelete(dto.ids);
}
```

- [ ] **Step 7: 运行测试确认通过**

Run:

```bash
yarn workspace @my-first-nest/server test tests/unit/modules/attachments/attachment-management.service.spec.ts
yarn workspace @my-first-nest/server test:e2e tests/e2e/attachments-management.e2e-spec.ts
```

Expected: 全部通过。

---

### Task 6: 清理任务触发和去重

**Files:**

- Modify: `apps/server/src/modules/attachments/services/attachment-management.service.ts`
- Modify: `apps/server/src/modules/attachments/attachments-management.controller.ts`
- Modify: `apps/server/src/modules/background-tasks/background-tasks.controller.ts`
- Modify: `apps/server/src/common/exceptions/attachment.exception.ts`
- Test: `apps/server/tests/unit/modules/attachments/attachment-management.service.spec.ts`
- Test: `apps/server/tests/unit/modules/background-tasks/cleanup-attachments.controller.spec.ts`（新建）
- Test: `apps/server/tests/e2e/attachments-management.e2e-spec.ts`

**Interfaces:**

- Produces:

```ts
triggerCleanup(user: User): Promise<IJobRunView>;
getLatestCleanup(): Promise<IJobRunView | null>;
```

- [ ] **Step 1: 写失败测试**

在 `attachment-management.service.spec.ts` 增加：

```ts
it("rejects cleanup when an active cleanup task exists", async () => {
  const { jobService, service } = createManagementService();
  jobService.hasActiveOrPending.mockResolvedValue(true);

  await expect(
    service.triggerCleanup({ id: "admin-id" } as User)
  ).rejects.toMatchObject({
    code: AttachmentExceptionCode.CLEANUP_ALREADY_RUNNING,
  });
});

it("submits a manual cleanup job", async () => {
  const { jobService, service } = createManagementService();
  jobService.hasActiveOrPending.mockResolvedValue(false);
  jobService.submit.mockResolvedValue({ id: "job-id" });

  await expect(
    service.triggerCleanup({ id: "admin-id" } as User)
  ).resolves.toEqual({ id: "job-id" });

  expect(jobService.submit).toHaveBeenCalledWith({
    name: JOB_NAMES.CLEANUP_ATTACHMENTS,
    payload: {},
    attempts: 3,
    backoffMs: 2000,
    triggerType: JOB_TRIGGER_TYPE.MANUAL,
    createdBy: "admin-id",
  });
});
```

新建 `cleanup-attachments.controller.spec.ts`：

```ts
import { BackgroundTasksController } from "@/modules/background-tasks/background-tasks.controller";
import { AttachmentExceptionCode } from "@/common/exceptions/attachment.exception";
import { JOB_NAMES } from "@/shared/jobs/constants/job.constants";
import { describe, expect, it, vi } from "vitest";

describe("BackgroundTasksController cleanup-attachments", () => {
  it("rejects a duplicate cleanup request", async () => {
    const jobService = {
      hasActiveOrPending: vi.fn().mockResolvedValue(true),
      submit: vi.fn(),
    };
    const controller = new BackgroundTasksController(jobService as never);

    await expect(
      controller.cleanupAttachments({ id: "admin-id" } as never)
    ).rejects.toMatchObject({
      code: AttachmentExceptionCode.CLEANUP_ALREADY_RUNNING,
    });
    expect(jobService.submit).not.toHaveBeenCalled();
  });

  it("submits cleanup with the authenticated user", async () => {
    const jobService = {
      hasActiveOrPending: vi.fn().mockResolvedValue(false),
      submit: vi.fn().mockResolvedValue({ id: "job-id" }),
    };
    const controller = new BackgroundTasksController(jobService as never);

    await expect(
      controller.cleanupAttachments({ id: "admin-id" } as never)
    ).resolves.toEqual({ id: "job-id" });
    expect(jobService.submit).toHaveBeenCalledWith({
      name: JOB_NAMES.CLEANUP_ATTACHMENTS,
      payload: {},
      attempts: 3,
      backoffMs: 2000,
      triggerType: "manual",
      createdBy: "admin-id",
    });
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
yarn workspace @my-first-nest/server test tests/unit/modules/attachments/attachment-management.service.spec.ts
yarn workspace @my-first-nest/server test tests/unit/modules/background-tasks/cleanup-attachments.controller.spec.ts
```

Expected: 清理触发方法不存在，测试失败。

- [ ] **Step 3: 增加错误码**

在 `attachment.exception.ts` 增加：

```ts
CLEANUP_ALREADY_RUNNING: 'ATTACHMENT_CLEANUP_ALREADY_RUNNING',
```

映射：

```ts
[AttachmentExceptionCode.CLEANUP_ALREADY_RUNNING]: {
  message: '附件清理任务正在执行，请稍后再试',
  status: HttpStatus.CONFLICT,
  code: AttachmentExceptionCode.CLEANUP_ALREADY_RUNNING,
},
```

- [ ] **Step 4: 实现清理触发和最近任务查询**

在 `AttachmentManagementService` 增加：

```ts
async triggerCleanup(user: User): Promise<IJobRunView> {
  const hasActiveOrPending = await this.jobService.hasActiveOrPending(
    JOB_NAMES.CLEANUP_ATTACHMENTS,
  );
  if (hasActiveOrPending) {
    throw new AttachmentException(
      AttachmentExceptionCode.CLEANUP_ALREADY_RUNNING,
    );
  }

  const job = await this.jobService.submit({
    name: JOB_NAMES.CLEANUP_ATTACHMENTS,
    payload: {},
    attempts: 3,
    backoffMs: 2000,
    triggerType: JOB_TRIGGER_TYPE.MANUAL,
    createdBy: user.id,
  });

  this.logger.log('Attachment cleanup triggered from management center', {
    category: LOG_CATEGORY.BUSINESS,
    context: { jobId: job.id },
  });

  return job;
}

async getLatestCleanup(): Promise<IJobRunView | null> {
  const page = await this.jobService.list({
    name: JOB_NAMES.CLEANUP_ATTACHMENTS,
    page: 1,
    pageSize: 1,
  });

  return page.list[0] ?? null;
}
```

- [ ] **Step 5: 增加管理控制器路由**

```ts
@Post('cleanup')
@Permission(PermissionCode.ATTACHMENT_MANAGE)
triggerCleanup(@UserInfo() user: User) {
  return this.attachmentManagementService.triggerCleanup(user);
}

@Get('cleanup/latest')
@Permission(PermissionCode.ATTACHMENT_READ)
getLatestCleanup() {
  return this.attachmentManagementService.getLatestCleanup();
}
```

注意：`@Get('cleanup/latest')` 必须定义在 `@Get(':id')` 之前，避免被参数路由吞掉。

- [ ] **Step 6: 给现有清理接口加权限和去重**

修改 `background-tasks.controller.ts`：

```ts
@Post('cleanup-attachments')
@Permission(PermissionCode.ATTACHMENT_MANAGE)
@ApiOperation({
  summary: '手动触发附件物理清理',
  description:
    '删除超过保留期的软删除附件和从未绑定的孤儿附件，最多重试 3 次',
})
async cleanupAttachments(@UserInfo() user: User) {
  const hasActiveOrPending = await this.jobService.hasActiveOrPending(
    JOB_NAMES.CLEANUP_ATTACHMENTS,
  );
  if (hasActiveOrPending) {
    throw new AttachmentException(
      AttachmentExceptionCode.CLEANUP_ALREADY_RUNNING,
    );
  }

  return this.jobService.submit({
    name: JOB_NAMES.CLEANUP_ATTACHMENTS,
    payload: {},
    attempts: 3,
    backoffMs: 2000,
    triggerType: JOB_TRIGGER_TYPE.MANUAL,
    createdBy: user.id,
  });
}
```

同时导入 `Permission`、`PermissionCode`、`AttachmentException` 和 `AttachmentExceptionCode`。

- [ ] **Step 7: 运行测试确认通过**

Run:

```bash
yarn workspace @my-first-nest/server test tests/unit/modules/attachments/attachment-management.service.spec.ts
yarn workspace @my-first-nest/server test tests/unit/modules/background-tasks/cleanup-attachments.controller.spec.ts
yarn workspace @my-first-nest/server test:e2e tests/e2e/attachments-management.e2e-spec.ts
```

Expected: 全部通过。

---

### Task 7: 管理接口 E2E 覆盖

**Files:**

- Modify: `apps/server/tests/e2e/attachments-management.e2e-spec.ts`

**Interfaces:**

- Consumes: 管理 API、文档 API、附件上传 API、清理任务 API。
- Produces: 覆盖权限、查询、签名、写操作、批量操作和清理去重的 E2E 测试。

- [ ] **Step 1: 增加测试辅助函数**

在 E2E 文件中增加：

```ts
const uploadAttachment = async (
  accessToken: string,
  visibility: "private" | "public" = "private"
) =>
  request(helper.getHttpServer())
    .post("/api/attachments")
    .set("Authorization", `Bearer ${accessToken}`)
    .field("visibility", visibility)
    .attach("files", Buffer.from("content"), {
      filename: "report.pdf",
      contentType: "application/pdf",
    })
    .expect(200);

const createDocument = async (accessToken: string, attachmentId: string) =>
  request(helper.getHttpServer())
    .post("/api/documents")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({
      title: "附件管理测试",
      content: "正文",
      attachmentIds: [attachmentId],
    })
    .expect(200);
```

- [ ] **Step 2: 增加查询和筛选测试**

```ts
it("lists normal, orphan and deleted attachments with filters", async () => {
  const orphan = await uploadAttachment(userAccessToken);
  const publicOrphan = await uploadAttachment(userAccessToken, "public");
  const bound = await uploadAttachment(userAccessToken);
  await createDocument(userAccessToken, bound.body[0].id);

  await request(helper.getHttpServer())
    .delete(`/api/documents/${bound.body[0].bizId}`)
    .set("Authorization", `Bearer ${userAccessToken}`);

  const response = await request(helper.getHttpServer())
    .get("/api/attachments/management")
    .query({
      includeDeleted: true,
      keyword: "report",
      visibility: "public",
    })
    .set("Authorization", `Bearer ${adminAccessToken}`)
    .expect(200);

  expect(response.body.total).toBe(1);
  expect(response.body.list[0].id).toBe(publicOrphan.body[0].id);
});

it("filters orphan attachments and ignores includeDeleted", async () => {
  await uploadAttachment(userAccessToken);

  const response = await request(helper.getHttpServer())
    .get("/api/attachments/management")
    .query({ orphanOnly: true, includeDeleted: true })
    .set("Authorization", `Bearer ${adminAccessToken}`)
    .expect(200);

  expect(
    response.body.list.every(
      (item: { status: string }) => item.status === "orphan"
    )
  ).toBe(true);
});
```

- [ ] **Step 3: 增加管理员读取已软删除附件测试**

```ts
it("lets admins read a soft deleted attachment with an admin signature", async () => {
  const upload = await uploadAttachment(userAccessToken);
  const created = await createDocument(userAccessToken, upload.body[0].id);
  await request(helper.getHttpServer())
    .delete(`/api/documents/${created.body.id}`)
    .set("Authorization", `Bearer ${userAccessToken}`)
    .expect(200);

  const signed = await request(helper.getHttpServer())
    .get(`/api/attachments/management/${upload.body[0].id}/signed-url`)
    .set("Authorization", `Bearer ${adminAccessToken}`)
    .expect(200);

  await request(helper.getHttpServer()).get(signed.body.url).expect(200);
});

it("does not let a user signature read a soft deleted attachment", async () => {
  const upload = await uploadAttachment(userAccessToken);
  const created = await createDocument(userAccessToken, upload.body[0].id);
  await request(helper.getHttpServer())
    .delete(`/api/documents/${created.body.id}`)
    .set("Authorization", `Bearer ${userAccessToken}`)
    .expect(200);

  const signed = await request(helper.getHttpServer())
    .get(`/api/attachments/${upload.body[0].id}/signed-url`)
    .set("Authorization", `Bearer ${userAccessToken}`)
    .expect(404);
});
```

注意：已绑定附件被软删除后，通用签名接口应返回 404；这条测试验证普通签名不能绕过软删除。

- [ ] **Step 4: 增加写操作和批量测试**

```ts
it("updates and soft deletes orphan attachments", async () => {
  const first = await uploadAttachment(userAccessToken);
  const second = await uploadAttachment(userAccessToken);

  await request(helper.getHttpServer())
    .patch(`/api/attachments/management/${first.body[0].id}/visibility`)
    .set("Authorization", `Bearer ${adminAccessToken}`)
    .send({ visibility: "public" })
    .expect(200);

  const result = await request(helper.getHttpServer())
    .post("/api/attachments/management/bulk/soft-delete")
    .set("Authorization", `Bearer ${adminAccessToken}`)
    .send({ ids: [first.body[0].id, second.body[0].id] })
    .expect(200);

  expect(result.body.succeeded).toEqual([first.body[0].id, second.body[0].id]);
});

it("rejects changing a bound attachment", async () => {
  const upload = await uploadAttachment(userAccessToken);
  await createDocument(userAccessToken, upload.body[0].id);

  await request(helper.getHttpServer())
    .patch(`/api/attachments/management/${upload.body[0].id}/visibility`)
    .set("Authorization", `Bearer ${adminAccessToken}`)
    .send({ visibility: "public" })
    .expect(409);
});
```

- [ ] **Step 5: 增加清理去重测试**

```ts
it("rejects a second cleanup trigger while one is active", async () => {
  const first = await request(helper.getHttpServer())
    .post("/api/attachments/management/cleanup")
    .set("Authorization", `Bearer ${adminAccessToken}`)
    .expect(201);

  await request(helper.getHttpServer())
    .post("/api/attachments/management/cleanup")
    .set("Authorization", `Bearer ${adminAccessToken}`)
    .expect(409);

  expect(first.body.id).toEqual(expect.any(String));
});
```

该测试不依赖 Redis；若任务系统缺少 Redis 会返回 503，此时改用 mock E2E 或跳过清理触发用例，并在结果中明确报告环境阻塞。

- [ ] **Step 6: 运行 E2E 确认通过**

Run:

```bash
yarn workspace @my-first-nest/server test:e2e tests/e2e/attachments-management.e2e-spec.ts
```

Expected: 全部通过；或仅清理触发用例因 Redis 缺失明确阻塞。

---

### Task 8: 前端管理 API 和类型

**Files:**

- Create: `apps/web/src/services/types/attachment-management.ts`
- Create: `apps/web/src/services/dtos/attachment-management.ts`
- Create: `apps/web/src/services/api/attachment-management.ts`
- Test: `apps/web/src/services/api/__tests__/attachment-management.test.ts`

**Interfaces:**

- Produces:

```ts
GetManagementAttachments(
  params?: IFindManagementAttachmentsQuery,
): Promise<IManagementAttachmentsPage>;

GetManagementAttachment(id: string): Promise<IManagementAttachment>;

GetManagementAttachmentSignedUrl(
  id: string,
): Promise<IAttachmentSignedUrl>;

UpdateManagementAttachmentVisibility(
  id: string,
  visibility: AttachmentVisibility,
): Promise<IManagementAttachment>;

SoftDeleteManagementAttachment(id: string): Promise<void>;

BulkUpdateManagementVisibility(
  ids: string[],
  visibility: AttachmentVisibility,
): Promise<IAttachmentBulkResult>;

BulkSoftDeleteManagementAttachments(
  ids: string[],
): Promise<IAttachmentBulkResult>;

TriggerManagementCleanup(): Promise<IJobRun>;

GetLatestManagementCleanup(): Promise<IJobRun | null>;
```

- [ ] **Step 1: 写失败测试**

创建 `attachment-management.test.ts`：

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const getMock = vi.hoisted(() => vi.fn());
const postMock = vi.hoisted(() => vi.fn());
const patchMock = vi.hoisted(() => vi.fn());

vi.mock("../new-http", () => ({
  default: {
    get: getMock,
    post: postMock,
    patch: patchMock,
  },
}));

describe("attachment management api", () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    patchMock.mockReset();
  });

  it("gets the management list with query params", async () => {
    getMock.mockResolvedValue({ data: { list: [], total: 0 } });
    const { GetManagementAttachments } =
      await import("../attachment-management");

    await GetManagementAttachments({ page: 2, orphanOnly: true });

    expect(getMock).toHaveBeenCalledWith("/attachments/management", {
      params: { page: 2, orphanOnly: true },
    });
  });

  it("gets the admin signed url", async () => {
    getMock.mockResolvedValue({ data: { url: "/signed", expiresAt: 1 } });
    const { GetManagementAttachmentSignedUrl } =
      await import("../attachment-management");

    await GetManagementAttachmentSignedUrl("attachment-id");

    expect(getMock).toHaveBeenCalledWith(
      "/attachments/management/attachment-id/signed-url"
    );
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
yarn workspace @my-first-nest/web test src/services/api/__tests__/attachment-management.test.ts
```

Expected: 模块不存在，测试失败。

- [ ] **Step 3: 定义类型和 DTO**

`attachment-management.ts` 类型：

```ts
import type { IAttachment, IAttachmentSignedUrl } from "./attachment";
import type { IJobRun } from "./job";

export type AttachmentManagementStatus = "bound" | "orphan" | "deleted";
export type AttachmentCleanupStatus = "not_candidate" | "waiting" | "eligible";

export interface IManagementAttachment extends Omit<IAttachment, "url"> {
  uploadedBy: {
    id: string;
    displayName: string;
  };
  status: AttachmentManagementStatus;
  cleanupStatus: AttachmentCleanupStatus;
  updatedAt: string;
  deletedAt: string | null;
  retentionDeadline?: string | null;
}

export interface IManagementAttachmentsPage {
  list: IManagementAttachment[];
  total: number;
  page: number;
  pageSize: number;
}

export interface IAttachmentBulkResult {
  succeeded: string[];
  failed: {
    id: string;
    reason: string;
  }[];
}

export type { IAttachmentSignedUrl, IJobRun };
```

`attachment-management.ts` DTO：

```ts
import type { AttachmentVisibility } from "../types/attachment";
import type {
  AttachmentCleanupStatus,
  AttachmentManagementStatus,
} from "../types/attachment-management";

export interface IFindManagementAttachmentsQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  mimeType?: string;
  visibility?: AttachmentVisibility;
  bizType?: string;
  bizId?: string;
  uploader?: string;
  includeDeleted?: boolean;
  orphanOnly?: boolean;
  createdFrom?: string;
  createdTo?: string;
}

export interface IManagementAttachmentFilters {
  keyword?: string;
  mimeType?: string;
  visibility?: AttachmentVisibility;
  status?: AttachmentManagementStatus;
  cleanupStatus?: AttachmentCleanupStatus;
}
```

- [ ] **Step 4: 实现 API**

`attachment-management.ts`：

```ts
import type { AttachmentVisibility } from "../types/attachment";
import type {
  IAttachmentBulkResult,
  IManagementAttachment,
  IManagementAttachmentsPage,
  IJobRun,
} from "../types/attachment-management";
import type { IFindManagementAttachmentsQuery } from "../dtos/attachment-management";
import http from "./new-http";

export const GetManagementAttachments = async (
  params?: IFindManagementAttachmentsQuery
) => {
  const response = await http.get<IManagementAttachmentsPage>(
    "/attachments/management",
    { params }
  );
  return response.data;
};

export const GetManagementAttachment = async (id: string) => {
  const response = await http.get<IManagementAttachment>(
    `/attachments/management/${id}`
  );
  return response.data;
};

export const GetManagementAttachmentSignedUrl = async (id: string) => {
  const response = await http.get<{ url: string; expiresAt: number }>(
    `/attachments/management/${id}/signed-url`
  );
  return response.data;
};

export const UpdateManagementAttachmentVisibility = async (
  id: string,
  visibility: AttachmentVisibility
) => {
  const response = await http.patch<IManagementAttachment>(
    `/attachments/management/${id}/visibility`,
    { visibility }
  );
  return response.data;
};

export const SoftDeleteManagementAttachment = async (id: string) => {
  await http.post(`/attachments/management/${id}/soft-delete`);
};

export const BulkUpdateManagementVisibility = async (
  ids: string[],
  visibility: AttachmentVisibility
) => {
  const response = await http.patch<IAttachmentBulkResult>(
    "/attachments/management/bulk/visibility",
    { ids, visibility }
  );
  return response.data;
};

export const BulkSoftDeleteManagementAttachments = async (ids: string[]) => {
  const response = await http.post<IAttachmentBulkResult>(
    "/attachments/management/bulk/soft-delete",
    { ids }
  );
  return response.data;
};

export const TriggerManagementCleanup = async () => {
  const response = await http.post<IJobRun>("/attachments/management/cleanup");
  return response.data;
};

export const GetLatestManagementCleanup = async () => {
  const response = await http.get<IJobRun | null>(
    "/attachments/management/cleanup/latest"
  );
  return response.data;
};
```

- [ ] **Step 5: 运行测试确认通过**

Run:

```bash
yarn workspace @my-first-nest/web test src/services/api/__tests__/attachment-management.test.ts
```

Expected: 测试通过。

---

### Task 9: 前端权限守卫和入口

**Files:**

- Create: `apps/web/src/components/root/user-permission-context.ts`
- Create: `apps/web/src/components/root/user-permission-provider.tsx`
- Create: `apps/web/src/router/permission-guard.tsx`
- Create: `apps/web/src/pages/management/attachments/index.tsx`（Task 10 会扩展）
- Modify: `apps/web/src/components/root/index.tsx`
- Modify: `apps/web/src/router/routes.tsx`
- Modify: `apps/web/src/components/app-sidebar/index.tsx`
- Modify: `apps/web/src/services/types/user.ts`
- Test: `apps/web/src/router/permission-guard.test.ts`

**Interfaces:**

- Produces:

```ts
const ATTACHMENT_MANAGEMENT_PERMISSIONS = {
  READ: "attachment:read",
  MANAGE: "attachment:manage",
} as const;

hasAnyPermission(
  userPermissions: string[] | undefined,
  requiredPermissions: string[],
): boolean;

PermissionGuard({
  permissions,
  children,
}: {
  permissions: string[];
  children?: ReactNode;
}): JSX.Element;
```

- [ ] **Step 1: 写失败测试**

创建 `permission-guard.test.ts`：

```ts
import { hasAnyPermission } from "./permission-guard";
import { describe, expect, it } from "vitest";

describe("hasAnyPermission", () => {
  it("returns true when the user has one required permission", () => {
    expect(hasAnyPermission(["attachment:read"], ["attachment:manage"])).toBe(
      false
    );
    expect(
      hasAnyPermission(
        ["attachment:read"],
        ["attachment:read", "attachment:manage"]
      )
    ).toBe(true);
  });

  it("returns false for empty permissions", () => {
    expect(hasAnyPermission([], ["attachment:read"])).toBe(false);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
yarn workspace @my-first-nest/web test src/router/permission-guard.test.ts
```

Expected: 模块不存在，测试失败。

- [ ] **Step 3: 实现权限 Context**

`user-permission-context.ts`：

```ts
import { createContext, useContext } from "react";

interface IUserPermissionContext {
  permissions: string[];
  isLoading: boolean;
}

export const UserPermissionContext = createContext<IUserPermissionContext>({
  permissions: [],
  isLoading: true,
});

export const useUserPermissionContext = () => useContext(UserPermissionContext);
```

`user-permission-provider.tsx`：

```tsx
import { GetUserPermissions } from "@/services/api/account";
import { useQuery } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import { UserPermissionContext } from "./user-permission-context";

export const UserPermissionProvider = ({ children }: PropsWithChildren) => {
  const { data = [], isLoading } = useQuery({
    queryKey: ["user-permissions"],
    queryFn: GetUserPermissions,
  });

  return (
    <UserPermissionContext.Provider
      value={{
        permissions: data.map((permission) => permission.code),
        isLoading,
      }}
    >
      {children}
    </UserPermissionContext.Provider>
  );
};
```

- [ ] **Step 4: 实现权限守卫**

`permission-guard.tsx`：

```tsx
import { Loading } from "@/components/loading";
import { useUserPermissionContext } from "@/components/root/user-permission-context";
import type { ReactNode } from "react";
import { Navigate, Outlet } from "react-router";

export const hasAnyPermission = (
  userPermissions: string[] | undefined,
  requiredPermissions: string[]
) =>
  requiredPermissions.some((permission) =>
    userPermissions?.includes(permission)
  );

interface IPermissionGuardProps {
  permissions: string[];
  children?: ReactNode;
}

export const PermissionGuard = ({
  permissions,
  children,
}: IPermissionGuardProps) => {
  const { permissions: userPermissions, isLoading } =
    useUserPermissionContext();

  if (isLoading) {
    return <Loading fullScreen />;
  }

  if (!hasAnyPermission(userPermissions, permissions)) {
    return <Navigate to="/" replace />;
  }

  return children ?? <Outlet />;
};
```

- [ ] **Step 5: 接入 Root 和路由**

修改 `apps/web/src/components/root/index.tsx`，在 `ProfileContext.Provider` 内包一层：

```tsx
<ProfileContext.Provider value={{ isLoading: isProfileLoading }}>
  <UserPermissionProvider>
    <SidebarProvider>{/* 现有结构保持不变 */}</SidebarProvider>
  </UserPermissionProvider>
</ProfileContext.Provider>
```

修改 `routes.tsx`：

````tsx
import { AttachmentsManagement } from "@/pages/management/attachments";

在现有 `/management` 父路由的 `children` 中增加：

```tsx
{
  path: "attachments",
  element: (
    <PermissionGuard permissions={["attachment:read"]}>
      <AttachmentsManagement />
    </PermissionGuard>
  ),
},
````

`PermissionGuard` 同时支持 `children` 和既有 `<Outlet />` 用法。本计划在
`/management` 父路由的 `children` 中直接包裹页面，确保最终访问路径固定为
`/management/attachments`，不产生 `/management/management/attachments`。

同时创建可编译的最小页面，供 Task 10 扩展：

```tsx
export const AttachmentsManagement = () => <div />;
```

- [ ] **Step 6: 增加侧边栏入口**

在 `app-sidebar/index.tsx` 中读取权限 Context：

```tsx
const { permissions } = useUserPermissionContext();
const canReadAttachments = permissions.includes("attachment:read");
```

在“后台管理”分组中条件加入：

```tsx
...(canReadAttachments
  ? [
      {
        name: "附件管理",
        icon: <PaperClipOutlined />,
        path: "/management/attachments",
      },
    ]
  : []),
```

- [ ] **Step 7: 运行验证**

Run:

```bash
yarn workspace @my-first-nest/web test src/router/permission-guard.test.ts
yarn workspace @my-first-nest/web type-check
```

Expected: 测试和类型检查通过。

---

### Task 10: 前端附件管理页面

**Files:**

- Create: `apps/web/src/pages/management/attachments/index.tsx`
- Create: `apps/web/src/pages/management/attachments/components/attachment-detail-drawer.tsx`
- Create: `apps/web/src/pages/management/attachments/components/attachment-filters.tsx`
- Create: `apps/web/src/pages/management/attachments/components/attachment-cleanup-card.tsx`
- Create: `apps/web/src/pages/management/attachments/components/attachment-bulk-actions.tsx`
- Create: `apps/web/src/pages/management/attachments/components/attachment-actions.tsx`
- Modify: `apps/web/src/components/data-table/index.tsx`

**Interfaces:**

- Consumes: `GetManagementAttachments`、`GetManagementAttachmentSignedUrl`、`UpdateManagementAttachmentVisibility`、`SoftDeleteManagementAttachment`、`BulkUpdateManagementVisibility`、`BulkSoftDeleteManagementAttachments`、`TriggerManagementCleanup`、`GetLatestManagementCleanup`。
- Produces: `/management/attachments` 可操作页面。

- [ ] **Step 1: 扩展 DataTable 支持 rowSelection**

修改 `IDataTableProps<T>`：

```ts
rowSelection?: TableProps<T>["rowSelection"];
```

透传到 `<Table>`：

```tsx
rowSelection = { rowSelection };
```

不改变现有默认行为。

- [ ] **Step 2: 实现页面主结构**

`index.tsx` 维护：

```ts
const [page, setPage] = useState(1);
const [pageSize, setPageSize] = useState(20);
const [filters, setFilters] = useState<IFindManagementAttachmentsQuery>({});
const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
const [viewingAttachmentId, setViewingAttachmentId] = useState<string>();
const [isDetailOpen, setIsDetailOpen] = useState(false);
```

查询：

```ts
const attachmentsQuery = useQuery({
  queryKey: ["attachments-management", { page, pageSize, ...filters }],
  queryFn: () =>
    GetManagementAttachments({
      page,
      pageSize,
      ...filters,
    }),
  placeholderData: (previous) => previous,
});
```

页面必须使用现有 `DataTable`，传入 `onPaginationChange` 和 `rowSelection`。

- [ ] **Step 3: 实现筛选区**

筛选字段：

- 文件名输入
- MIME 输入
- 可见性选择
- `includeDeleted` 开关
- `orphanOnly` 开关

筛选变化时：

```ts
setPage(1);
setSelectedRowKeys([]);
```

`orphanOnly=true` 时禁用 `includeDeleted` 开关，避免组合歧义。

- [ ] **Step 4: 实现行操作**

`attachment-actions.tsx` 接收：

```ts
interface IAttachmentActionsProps {
  attachment: IManagementAttachment;
  canManage: boolean;
  onView: (attachment: IManagementAttachment) => void;
  onRefresh: () => void;
}
```

行内提供：

- 复制链接
- 预览
- 打开
- 下载
- 修改可见性
- 软删除

链接处理必须复用现有 `resolveAttachmentUrl` 和 `createAttachmentDownloadUrl`，签名 URL 通过 `GetManagementAttachmentSignedUrl` 获取。

写操作按钮仅在以下条件可用：

```ts
canManage && attachment.status === "orphan";
```

已绑定或已删除附件必须显示禁用状态和 Tooltip 原因。

- [ ] **Step 5: 实现批量操作**

`attachment-bulk-actions.tsx`：

- 无选择时禁用
- 最多选择 100 条
- 提供“设为公开”“设为私有”“软删除”
- 操作后展示成功数、失败数和失败原因

部分失败时：

```ts
message.warning(
  `成功 ${result.succeeded.length} 条，失败 ${result.failed.length} 条`
);
```

并清空选择、刷新列表。

- [ ] **Step 6: 实现详情 Drawer 和清理卡片**

详情 Drawer 展示：

- 文件名、MIME、大小
- 可见性
- 上传人
- 业务类型和业务 ID
- 附件状态
- 清理状态
- 创建、更新、删除时间
- 保留期截止时间

清理卡片展示最近一次 `cleanup-attachments` job：

- 状态
- 进度
- 结果
- 失败原因
- 触发按钮

触发成功后：

```ts
message.success("附件清理任务已提交");
queryClient.invalidateQueries({
  queryKey: ["attachments-management", "cleanup-latest"],
});
```

- [ ] **Step 7: 确认路由接入**

确认 Task 9 已把 `/management/attachments` 路由指向
`apps/web/src/pages/management/attachments/index.tsx`。本步骤不修改路由文件。

- [ ] **Step 8: 运行验证**

Run:

```bash
yarn workspace @my-first-nest/web type-check
yarn workspace @my-first-nest/web lint
yarn workspace @my-first-nest/web test
yarn workspace @my-first-nest/web build
```

Expected: 全部通过；构建仅允许既有 chunk size 警告。

---

### Task 11: 文档更新与最终验证

**Files:**

- Modify: `apps/server/src/modules/attachments/README.md`
- Modify: `apps/server/src/modules/documents/README.md`
- Modify: `apps/web/src/pages/management/attachments/index.tsx`

**Interfaces:**

- Consumes: 已完成的后端和前端实现。
- Produces: 与实现一致的模块文档和最终验收证据。

- [ ] **Step 1: 更新附件模块 README**

补充：

```md
## 管理入口

- `GET /api/attachments/management`
- `GET /api/attachments/management/:id`
- `GET /api/attachments/management/:id/signed-url`
- `PATCH /api/attachments/management/:id/visibility`
- `POST /api/attachments/management/:id/soft-delete`
- `PATCH /api/attachments/management/bulk/visibility`
- `POST /api/attachments/management/bulk/soft-delete`
- `POST /api/attachments/management/cleanup`

管理员签名作用域为 `admin`，可以读取正常、未绑定和已软删除附件。普通签名作用域为 `user`，不能读取已软删除附件。已绑定附件不能在管理页修改可见性或删除。
```

- [ ] **Step 2: 更新文档模块 README**

补充：

```md
文档附件在附件管理中心只作为绑定业务展示和跳转目标。已绑定文档的附件不能在附件管理中心修改可见性或软删除，必须回到文档编辑流程处理。
```

- [ ] **Step 3: 运行最终验证**

Run:

```bash
yarn workspace @my-first-nest/server type-check
yarn workspace @my-first-nest/server test
yarn workspace @my-first-nest/server test:e2e
yarn workspace @my-first-nest/web type-check
yarn workspace @my-first-nest/web test
yarn workspace @my-first-nest/web build
yarn prettier --check apps/server/src/common/constants/permissions/attachments.permission.ts apps/server/src/modules/attachments apps/web/src/pages/management/attachments apps/web/src/services/api/attachment-management.ts apps/web/src/services/dtos/attachment-management.ts apps/web/src/services/types/attachment-management.ts apps/web/src/router/permission-guard.tsx apps/server/src/modules/attachments/README.md apps/server/src/modules/documents/README.md
git diff --check
```

Expected:

- server type-check 通过。
- server 单元测试全部通过。
- server E2E 全部通过，或仅外部 Redis 缺失导致清理触发用例明确阻塞。
- web type-check、test、build 通过。
- Prettier 和 `git diff --check` 无输出。

- [ ] **Step 4: 手工验收**

按 spec 的 11.3 手工验收执行。

---

## Self-Review

**Spec coverage:**

- 权限模型：Task 1、Task 9。
- 附件状态和清理状态：Task 2。
- 管理员签名作用域：Task 3。
- 管理查询和详情：Task 4。
- 单条和批量写操作：Task 5。
- 清理触发和去重：Task 6。
- E2E 覆盖：Task 7。
- 前端 API 类型：Task 8。
- 路由和权限守卫：Task 9。
- 管理页面：Task 10。
- 文档和最终验证：Task 11。

**Type consistency:**

- 后端列表项、详情、批量结果类型在 Task 2、Task 4、Task 5 中保持一致。
- 前端 `IManagementAttachment` 与后端 `IAttachmentManagementItem` 字段一致，额外包含详情字段 `retentionDeadline`。
- 签名 scope 名称统一为 `user` 和 `admin`。
- 清理任务名称统一使用 `JOB_NAMES.CLEANUP_ATTACHMENTS`。

**Placeholder scan:**

- 所有任务均给出具体文件、接口、测试代码和验证命令。
- 没有 TODO、TBD 或“按需实现”占位符。
- 清理任务若因 Redis 缺失无法 E2E，要求明确报告环境阻塞，不允许伪造通过。
