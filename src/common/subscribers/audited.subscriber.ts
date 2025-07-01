import { User } from '@/modules/users/entities';
import { AuditedEntity } from '@/shared/entity/audited.entity';
import {
  EntitySubscriberInterface,
  EventSubscriber,
  InsertEvent,
  UpdateEvent,
} from 'typeorm';
import { useRequestUser } from '../context';

@EventSubscriber()
export class AuditedSubscriber
  implements EntitySubscriberInterface<AuditedEntity>
{
  listenTo() {
    return AuditedEntity;
  }

  private getUser(): User | undefined {
    try {
      return useRequestUser();
    } catch (e) {
      return undefined;
    }
  }

  beforeInsert(event: InsertEvent<AuditedEntity>): void | Promise<any> {
    const user = this.getUser();
    if (user) {
      event.entity.createdBy = user;
      event.entity.updatedBy = user;
    }
  }

  beforeUpdate(event: UpdateEvent<AuditedEntity>): void | Promise<any> {
    // 当使用 update() 方法时，是直接执行数据库的 UPDATE 语句，不会触发 beforeUpdate 事件
    // 只有当使用 save() 方法时，才会触发 beforeUpdate 事件
    if (event.entity) {
      const user = this.getUser();
      if (user) {
        event.entity.updatedBy = user;
      }
    }
  }
}
