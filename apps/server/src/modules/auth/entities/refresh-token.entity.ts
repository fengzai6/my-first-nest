import { User } from '@/modules/users/entities';
import { BaseEntity } from '@/shared/entity/base.entity';
import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';

@Entity('users_refresh_tokens')
export class RefreshToken extends BaseEntity {
  @Column()
  token: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  expiresAt: Date;

  // 目前退出登录使用直接移除的方式，所以不需要这个字段
  // @Column({
  //   default: false,
  // })
  // isRevoked: boolean;
}
