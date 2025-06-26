### TypeORM `save` 方法与生命周期钩子（如 `@BeforeInsert`）

**问题核心:**

`@BeforeInsert` 这类 TypeORM 的生命周期钩子，只有在通过 `repository.save()` 方法保存一个**实体类的实例**时才会被触发。如果传递给 `save()` 方法的是一个普通的 JavaScript 对象（plain object），钩子将被完全忽略。

在数据填充（seeding）脚本中，我们常常会定义一些常量数据（如权限、角色等），这些都是普通对象。如果直接将它们传给 `save()`，就会导致依赖于 `@BeforeInsert` 的逻辑（如雪花ID生成）不执行。

**错误示例 (钩子不执行):**

```typescript
// 在 seed 脚本中
const plainPermissionObject = { name: '创建用户', code: 'user:create' };

// 直接保存一个普通对象，@BeforeInsert 不会触发
await permissionRepository.save(plainPermissionObject);

// 结果: 数据库会报错，因为 'id' 字段为 null
```

**正确示例 (钩子会执行):**

```typescript
// 在 seed 脚本中
const plainPermissionObject = { name: '创建用户', code: 'user:create' };

// 1. 使用 repository.create() 将普通对象转换为实体实例
const permissionEntity = permissionRepository.create(plainPermissionObject);

// 2. 保存实体实例，此时 @BeforeInsert 会被触发
await permissionRepository.save(permissionEntity);

// 结果: ID 被成功生成并保存到数据库
```

**总结:**

为了确保 TypeORM 的生命周期钩子能够被正确执行，务必在调用 `repository.save()` 之前，使用 `repository.create()` 方法将普通数据对象转换为对应的实体实例。
