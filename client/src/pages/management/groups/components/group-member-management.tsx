import type {
  IAddGroupMembersDto,
  IUpdateGroupMemberDto,
} from "@/services/dtos/group";
import type { GroupMemberRoles, IGroup } from "@/services/types/group";
import { GroupMemberRoles as GroupMemberRolesConst } from "@/services/types/group";
import type { IUser } from "@/services/types/user";
import { DeleteOutlined, PlusOutlined, UserOutlined } from "@ant-design/icons";
import {
  Avatar,
  Button,
  Card,
  Divider,
  Empty,
  List,
  Popconfirm,
  Select,
  Space,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import { useState } from "react";

const { Title, Text } = Typography;
const { Option } = Select;

interface GroupMemberManagementProps {
  group: IGroup | null;
  users: IUser[];
  onAddMembers: (data: IAddGroupMembersDto) => void;
  onUpdateMember: (userId: string, data: IUpdateGroupMemberDto) => void;
  onRemoveMember: (userId: string) => void;
  loading: {
    addMembers: boolean;
    updateMember: boolean;
    removeMember: boolean;
  };
}

export const GroupMemberManagement = ({
  group,
  users,
  onAddMembers,
  onUpdateMember,
  onRemoveMember,
  loading,
}: GroupMemberManagementProps) => {
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  if (!group) return null;

  // 获取可添加的用户（不在当前群组的用户）
  const getAvailableUsers = () => {
    const memberUserIds = new Set(group.members?.map((m) => m.user.id) || []);
    return users.filter((user) => !memberUserIds.has(user.id));
  };

  // 处理添加成员
  const handleAddMembers = () => {
    if (selectedUserIds.length > 0) {
      onAddMembers({ members: selectedUserIds });
      setSelectedUserIds([]);
    }
  };

  // 处理更新成员角色
  const handleUpdateMemberRole = (userId: string, role: GroupMemberRoles) => {
    onUpdateMember(userId, { role });
  };

  // 获取角色显示名称
  const getRoleDisplayName = (role: GroupMemberRoles) => {
    switch (role) {
      case GroupMemberRolesConst.Leader:
        return "组长";
      case GroupMemberRolesConst.Member:
        return "成员";
      default:
        return role;
    }
  };

  // 获取角色颜色
  const getRoleColor = (role: GroupMemberRoles) => {
    switch (role) {
      case GroupMemberRolesConst.Leader:
        return "red";
      case GroupMemberRolesConst.Member:
        return "blue";
      default:
        return "default";
    }
  };

  const availableUsers = getAvailableUsers();

  return (
    <div className="space-y-4">
      {/* 添加成员区域 */}
      <Card size="small" title="添加新成员">
        <div className="space-y-3">
          <Select
            mode="multiple"
            placeholder="选择要添加的用户"
            style={{ width: "100%" }}
            value={selectedUserIds}
            onChange={setSelectedUserIds}
            showSearch
            filterOption={(input, option) => {
              const user = users.find((u) => u.id === option?.value);
              return (
                user?.username.toLowerCase().includes(input.toLowerCase()) ||
                user?.displayName.toLowerCase().includes(input.toLowerCase()) ||
                user?.email?.toLowerCase().includes(input.toLowerCase()) ||
                false
              );
            }}
          >
            {availableUsers.map((user) => (
              <Option key={user.id} value={user.id}>
                <div className="flex items-center">
                  <Avatar
                    size="small"
                    src={user.avatar}
                    icon={<UserOutlined />}
                    className="mr-2"
                  />
                  <span>
                    {user.displayName} ({user.username})
                  </span>
                </div>
              </Option>
            ))}
          </Select>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleAddMembers}
            disabled={selectedUserIds.length === 0}
            loading={loading.addMembers}
            block
          >
            添加成员 ({selectedUserIds.length})
          </Button>
        </div>
      </Card>

      <Divider />

      {/* 现有成员列表 */}
      <div>
        <Title level={4}>群组成员 ({group.members?.length || 0})</Title>

        {!group.members || group.members.length === 0 ? (
          <Empty description="暂无成员" />
        ) : (
          <List
            dataSource={group.members}
            renderItem={(member) => (
              <List.Item
                actions={[
                  <Select
                    key="role-select"
                    value={member.role}
                    onChange={(role) =>
                      handleUpdateMemberRole(member.user.id, role)
                    }
                    loading={loading.updateMember}
                    style={{ width: 100 }}
                  >
                    <Option value={GroupMemberRolesConst.Member}>
                      {getRoleDisplayName(GroupMemberRolesConst.Member)}
                    </Option>
                    <Option value={GroupMemberRolesConst.Leader}>
                      {getRoleDisplayName(GroupMemberRolesConst.Leader)}
                    </Option>
                  </Select>,
                  <Popconfirm
                    key="remove"
                    title="确认移除"
                    description="确定要将此用户从群组中移除吗？"
                    onConfirm={() => onRemoveMember(member.user.id)}
                    okText="确认"
                    cancelText="取消"
                  >
                    <Tooltip title="移除成员">
                      <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        loading={loading.removeMember}
                      />
                    </Tooltip>
                  </Popconfirm>,
                ]}
              >
                <List.Item.Meta
                  avatar={
                    <Avatar src={member.user.avatar} icon={<UserOutlined />} />
                  }
                  title={
                    <Space>
                      <span>{member.user.displayName}</span>
                      <Text type="secondary">({member.user.username})</Text>
                      <Tag color={getRoleColor(member.role)}>
                        {getRoleDisplayName(member.role)}
                      </Tag>
                    </Space>
                  }
                  description={member.user.email}
                />
              </List.Item>
            )}
          />
        )}
      </div>
    </div>
  );
};
