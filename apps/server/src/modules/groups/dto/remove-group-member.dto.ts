import { IsNotEmpty, IsString } from 'class-validator';

export class RemoveGroupMemberDto {
  @IsNotEmpty()
  @IsString()
  groupId: string;

  @IsNotEmpty()
  @IsString()
  userId: string;
}
