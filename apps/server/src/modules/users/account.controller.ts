import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UpdatePasswordDto } from './dto/update-password';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@ApiTags('Account')
@ApiBearerAuth()
@Controller('account')
export class AccountController {
  constructor(private readonly usersService: UsersService) {}

  @ApiOperation({
    summary: '获取当前用户信息',
  })
  @Get('profile')
  getProfile() {
    return this.usersService.getProfile();
  }

  @ApiOperation({
    summary: '修改当前用户信息(包括角色）',
  })
  @Patch('profile')
  updateProfile(@Body() updateProfileDto: UpdateUserDto) {
    return this.usersService.updateProfile(updateProfileDto);
  }

  @ApiOperation({
    summary: '修改当前用户密码',
  })
  @Post('password')
  updatePassword(@Body() updatePasswordDto: UpdatePasswordDto) {
    return this.usersService.updatePassword(updatePasswordDto);
  }

  @ApiOperation({
    summary: '获取当前用户权限',
  })
  @Get('permissions')
  getPermissions() {
    return this.usersService.getPermissions();
  }
}
