import { IsNotEmpty, IsString } from 'class-validator';

export class JoinRoomDto {
  @IsString()
  @IsNotEmpty()
  room!: string;
}

export class LeaveRoomDto {
  @IsString()
  @IsNotEmpty()
  room!: string;
}

export class SendToRoomDto {
  @IsString()
  @IsNotEmpty()
  room!: string;

  @IsString()
  @IsNotEmpty()
  message!: string;
}

export class SendToUserDto {
  @IsString()
  @IsNotEmpty()
  targetUserId!: string;

  @IsString()
  @IsNotEmpty()
  message!: string;
}

export class BroadcastDto {
  @IsString()
  @IsNotEmpty()
  message!: string;
}
