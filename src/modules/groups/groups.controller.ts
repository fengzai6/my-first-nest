import { PermissionCode } from '@/common/constants';
import { GroupLeaderOrCreator } from '@/common/decorators/group-member-roles.decorator';
import { UserInfo } from '@/common/decorators/jwt-auth.decorator';
import { Permission } from '@/common/decorators/permission.decorator';
import { GroupMemberRolesGuard } from '@/common/guards/group-member-roles.guard';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { User } from '../users/entities';
import { AddGroupMembersDto } from './dto/create-group-members.dto';
import { CreateGroupDto } from './dto/create-group.dto';
import { GroupsService } from './groups.service';

@Controller('groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Permission(PermissionCode.GROUP_CREATE)
  @ApiOperation({
    summary: '创建群组',
  })
  @ApiBearerAuth()
  @Post()
  createGroup(@Body() createGroupDto: CreateGroupDto, @UserInfo() user: User) {
    return this.groupsService.createGroup(createGroupDto, user);
  }

  @Permission(PermissionCode.GROUP_READ)
  @ApiOperation({
    summary: '添加群组成员',
  })
  @ApiBearerAuth()
  @UseGuards(GroupMemberRolesGuard)
  @GroupLeaderOrCreator()
  @Post(':groupId/members')
  addGroupMembers(
    @Param('groupId') groupId: number,
    @Body() addGroupMembersDto: AddGroupMembersDto,
  ) {
    return this.groupsService.addGroupMembers(groupId, addGroupMembersDto);
  }

  @Permission(PermissionCode.GROUP_UPDATE)
  @ApiOperation({
    summary: '移除群组成员',
  })
  @ApiBearerAuth()
  @UseGuards(GroupMemberRolesGuard)
  @GroupLeaderOrCreator()
  @Delete(':groupId/members/:userId')
  removeGroupMember(
    @Param('groupId') groupId: number,
    @Param('userId') userId: number,
  ) {
    return this.groupsService.removeGroupMember({ groupId, userId });
  }

  @Permission(PermissionCode.GROUP_READ)
  @ApiOperation({
    summary: '获取用户群组树',
  })
  @ApiBearerAuth()
  @Get('treeByUser')
  getGroupTreeByUser(@UserInfo() user: User) {
    return this.groupsService.getGroupTreeByUser(user);
  }
}
