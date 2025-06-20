import 'typeorm';
import { ObjectId } from 'typeorm/driver/mongodb/typings';
import { FindOptionsWhere } from 'typeorm/find-options/FindOptionsWhere';
import { DeleteResult } from 'typeorm/query-builder/result/DeleteResult';

declare module 'typeorm' {
  interface Repository<Entity> {
    /**
     * @deprecated 请使用 softRemove 代替，本程序为软删除操作
     */
    delete(
      criteria:
        | string
        | string[]
        | number
        | number[]
        | Date
        | Date[]
        | ObjectId
        | ObjectId[]
        | FindOptionsWhere<Entity>
        | FindOptionsWhere<Entity>[],
    ): Promise<DeleteResult>;

    /**
     * @deprecated 请使用 softRemove 代替，本程序为软删除操作
     */
    remove(entities: Entity[], options?: RemoveOptions): Promise<Entity[]>;
  }
}

export {};
