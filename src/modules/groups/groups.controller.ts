import { UserInfo } from '@/common/decorators/jwt-auth.decorator';
import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { User } from '../users/entities';
import { AddGroupMembersDto } from './dto/create-group-members.dto';
import { CreateGroupDto } from './dto/create-group.dto';
import { GroupsService } from './groups.service';

@Controller('groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @ApiOperation({
    summary: '创建群组',
  })
  @ApiBearerAuth()
  @Post()
  createGroup(@Body() createGroupDto: CreateGroupDto, @UserInfo() user: User) {
    return this.groupsService.createGroup(createGroupDto, user);
  }

  @ApiOperation({
    summary: '添加群组成员',
  })
  @ApiBearerAuth()
  @Post(':id/members')
  addGroupMembers(
    @Param('id') id: number,
    @Body() addGroupMembersDto: AddGroupMembersDto,
  ) {
    return this.groupsService.addGroupMembers(id, addGroupMembersDto);
  }

  @ApiOperation({
    summary: '移除群组成员',
  })
  @ApiBearerAuth()
  @Delete(':groupId/members/:userId')
  removeGroupMember(
    @Param('groupId') groupId: number,
    @Param('userId') userId: number,
  ) {
    return this.groupsService.removeGroupMember({ groupId, userId });
  }

  @ApiOperation({
    summary: '获取用户群组树',
  })
  @ApiBearerAuth()
  @Get('treeByUser')
  getGroupTreeByUser(@UserInfo() user: User) {
    return this.groupsService.getGroupTreeByUser(user);
  }
}
