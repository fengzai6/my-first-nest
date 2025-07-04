import { PermissionCode } from '@/common/constants';
import {
  DisabledEndpoint,
  GroupMemberRoles,
  GroupMemberRolesEnum,
  Permission,
} from '@/common/decorators';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AddGroupMembersDto } from './dto/create-group-members.dto';
import { CreateGroupDto, CreateRootOrgGroupDto } from './dto/create-group.dto';
import { UpdateGroupMemberDto } from './dto/update-group-member.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { Group } from './entities';
import { GroupsService } from './groups.service';

/**
 * 群组控制器
 *
 * 群组可以有多个子群组，可以有多个成员
 * 群组中只有本组领导和上级组领导可以修改群组信息
 * TODO: 群组可以有多个角色，角色会继承给组内成员
 */
@ApiBearerAuth()
@Controller('groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @ApiOperation({
    summary: '创建群组 - NeedPermission',
  })
  @Permission(PermissionCode.GROUP_CREATE)
  @GroupMemberRoles([GroupMemberRolesEnum.Leader])
  @Post()
  createGroup(@Body() createGroupDto: CreateGroupDto): Promise<Group> {
    return this.groupsService.createGroup(createGroupDto);
  }

  @ApiOperation({
    summary: '创建根组织群组 - NeedPermission',
  })
  @Permission(PermissionCode.GROUP_CREATE)
  @Post('rootOrg')
  createRootOrganizationGroup(
    @Body() createOrganizationGroupDto: CreateRootOrgGroupDto,
  ) {
    return this.groupsService.createGroup({
      ...createOrganizationGroupDto,
      isOrganization: true,
    });
  }

  @ApiOperation({
    summary: '更新群组 - NeedPermission',
  })
  @Permission(PermissionCode.GROUP_UPDATE)
  @GroupMemberRoles([GroupMemberRolesEnum.Leader])
  @Patch(':groupId')
  updateGroup(
    @Param('groupId') groupId: string,
    @Body() updateGroupDto: UpdateGroupDto,
  ) {
    return this.groupsService.updateGroup(groupId, updateGroupDto);
  }

  @DisabledEndpoint()
  @ApiOperation({
    summary: '更新群组的权限角色，组内用户会继承角色 - NeedPermission',
  })
  @Permission(PermissionCode.GROUP_UPDATE)
  @GroupMemberRoles([GroupMemberRolesEnum.SuperiorLeader])
  @Post(':groupId/roles')
  updateGroupRole(
    @Param('groupId') groupId: string,
    @Body() updateGroupRoleDto: undefined,
  ) {
    return 'hello';
  }

  @ApiOperation({
    summary: '获取用户群组树',
  })
  @Get('treesByUser')
  getGroupTreesByUser() {
    return this.groupsService.getGroupTreesByUser();
  }

  @ApiOperation({
    summary: '获取群组树 - NeedPermission',
  })
  @Permission(PermissionCode.GROUP_READ)
  @Get('trees')
  getGroupTrees() {
    return this.groupsService.getGroupTrees();
  }

  @ApiOperation({
    summary: '添加群组成员 - NeedPermission',
  })
  @Permission(PermissionCode.GROUP_UPDATE)
  @GroupMemberRoles([GroupMemberRolesEnum.Leader])
  @Post(':groupId/members')
  addGroupMembers(
    @Param('groupId') groupId: string,
    @Body() addGroupMembersDto: AddGroupMembersDto,
  ) {
    return this.groupsService.addGroupMembers(groupId, addGroupMembersDto);
  }

  @ApiOperation({
    summary: '更新群组成员角色 - NeedPermission',
  })
  @Permission(PermissionCode.GROUP_UPDATE)
  @GroupMemberRoles([GroupMemberRolesEnum.Leader])
  @Patch(':groupId/members/:userId')
  updateGroupMember(
    @Param('groupId') groupId: string,
    @Param('userId') userId: string,
    @Body() updateGroupMemberDto: UpdateGroupMemberDto,
  ) {
    return this.groupsService.updateGroupMember(
      groupId,
      userId,
      updateGroupMemberDto,
    );
  }

  @ApiOperation({
    summary: '移除群组成员 - NeedPermission',
  })
  @Permission(PermissionCode.GROUP_UPDATE)
  @GroupMemberRoles([GroupMemberRolesEnum.Leader])
  @Delete(':groupId/members/:userId')
  removeGroupMember(
    @Param('groupId') groupId: string,
    @Param('userId') userId: string,
  ) {
    return this.groupsService.removeGroupMember(groupId, userId);
  }
}
