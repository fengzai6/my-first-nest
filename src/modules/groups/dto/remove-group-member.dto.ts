import { IsNotEmpty, IsNumber } from 'class-validator';

export class RemoveGroupMemberDto {
  @IsNotEmpty()
  @IsNumber()
  groupId: number;

  @IsNotEmpty()
  @IsNumber()
  userId: number;
}
