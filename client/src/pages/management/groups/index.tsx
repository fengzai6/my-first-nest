import {
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Card,
  Input,
  message,
  Modal,
  Space,
  Table,
  Tag,
  Tooltip,
  Tree,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useState } from "react";

import {
  AddGroupMembers,
  CreateGroup,
  CreateRootOrgGroup,
  GetGroupTrees,
  RemoveGroupMember,
  UpdateGroup,
  UpdateGroupMember,
} from "@/services/api/group";
import { GetUsers } from "@/services/api/user";
import type {
  IAddGroupMembersDto,
  ICreateGroupDto,
  ICreateRootOrgGroupDto,
  IUpdateGroupDto,
  IUpdateGroupMemberDto,
} from "@/services/dtos/group";
import type { IGroup } from "@/services/types/group";
import { GroupForm, GroupMemberManagement } from "./components";

const { Title } = Typography;
const { Search } = Input;

export const Groups = () => {
  const [searchText, setSearchText] = useState("");
  const [isGroupFormOpen, setIsGroupFormOpen] = useState(false);
  const [isMemberManagementOpen, setIsMemberManagementOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<IGroup | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<IGroup | null>(null);
  const [viewMode, setViewMode] = useState<"tree" | "table">("table");

  const queryClient = useQueryClient();

  // 获取群组树
  const {
    data: groupTrees = [],
    isLoading: groupsLoading,
    error: groupsError,
    refetch: refetchGroups,
  } = useQuery({
    queryKey: ["groups", "trees"],
    queryFn: GetGroupTrees,
  });

  // 获取用户列表（用于成员管理）
  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: GetUsers,
  });

  // 扩展的群组类型，包含层级信息
  type IGroupWithLevel = IGroup & { level?: number };

  // 扁平化群组数据用于表格显示
  const flattenGroups = (groups: IGroup[]): IGroupWithLevel[] => {
    const result: IGroupWithLevel[] = [];
    const flatten = (items: IGroup[], level = 0) => {
      items.forEach((item) => {
        result.push({ ...item, level });
        if (item.children && item.children.length > 0) {
          flatten(item.children, level + 1);
        }
      });
    };
    flatten(groups);
    return result;
  };

  const allGroups = flattenGroups(groupTrees);

  // 当群组数据更新时，同步更新选中的群组数据
  useEffect(() => {
    if (selectedGroup && allGroups.length > 0) {
      const updatedGroup = allGroups.find((g) => g.id === selectedGroup.id);
      if (updatedGroup) {
        // 比较成员数量和成员信息，如果有变化则更新
        const currentMemberCount = selectedGroup.members?.length || 0;
        const updatedMemberCount = updatedGroup.members?.length || 0;

        if (currentMemberCount !== updatedMemberCount) {
          setSelectedGroup(updatedGroup);
        } else if (selectedGroup.members && updatedGroup.members) {
          // 检查成员角色是否有变化
          const memberRolesChanged = selectedGroup.members.some(
            (member, index) => {
              const updatedMember = updatedGroup.members?.[index];
              return updatedMember && member.role !== updatedMember.role;
            },
          );

          if (memberRolesChanged) {
            setSelectedGroup(updatedGroup);
          }
        }
      }
    }
  }, [allGroups, selectedGroup]);

  // 创建群组
  const createGroupMutation = useMutation({
    mutationFn: CreateGroup,
    onSuccess: () => {
      message.success("群组创建成功");
      setIsGroupFormOpen(false);
      queryClient.invalidateQueries({ queryKey: ["groups"] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || "创建群组失败");
    },
  });

  // 创建根组织群组
  const createRootOrgGroupMutation = useMutation({
    mutationFn: (data: ICreateRootOrgGroupDto) => CreateRootOrgGroup(data),
    onSuccess: () => {
      message.success("根组织群组创建成功");
      setIsGroupFormOpen(false);
      queryClient.invalidateQueries({ queryKey: ["groups"] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || "创建根组织群组失败");
    },
  });

  // 更新群组
  const updateGroupMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: IUpdateGroupDto }) =>
      UpdateGroup(id, data),
    onSuccess: () => {
      message.success("群组更新成功");
      setIsGroupFormOpen(false);
      setEditingGroup(null);
      queryClient.invalidateQueries({ queryKey: ["groups"] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || "更新群组失败");
    },
  });

  // 添加群组成员
  const addGroupMembersMutation = useMutation({
    mutationFn: ({
      groupId,
      data,
    }: {
      groupId: string;
      data: IAddGroupMembersDto;
    }) => AddGroupMembers(groupId, data),
    onSuccess: () => {
      message.success("添加成员成功");
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      // 重新获取群组数据后会自动更新selectedGroup
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || "添加成员失败");
    },
  });

  // 更新群组成员
  const updateGroupMemberMutation = useMutation({
    mutationFn: ({
      groupId,
      userId,
      data,
    }: {
      groupId: string;
      userId: string;
      data: IUpdateGroupMemberDto;
    }) => UpdateGroupMember(groupId, userId, data),
    onSuccess: () => {
      message.success("更新成员角色成功");
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      // 重新获取群组数据后会自动更新selectedGroup
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || "更新成员角色失败");
    },
  });

  // 移除群组成员
  const removeGroupMemberMutation = useMutation({
    mutationFn: ({ groupId, userId }: { groupId: string; userId: string }) =>
      RemoveGroupMember(groupId, userId),
    onSuccess: () => {
      message.success("移除成员成功");
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      // 重新获取群组数据后会自动更新selectedGroup
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || "移除成员失败");
    },
  });

  // 过滤群组数据
  const filteredGroups = allGroups.filter(
    (group) =>
      group.name.toLowerCase().includes(searchText.toLowerCase()) ||
      group.description?.toLowerCase().includes(searchText.toLowerCase()),
  );

  // 处理编辑群组
  const handleEditGroup = (group: IGroup) => {
    setEditingGroup(group);
    setIsGroupFormOpen(true);
  };

  // 处理管理成员
  const handleManageMembers = (group: IGroup) => {
    setSelectedGroup(group);
    setIsMemberManagementOpen(true);
  };

  // 构建树形数据
  const buildTreeData = (groups: IGroup[]): any[] => {
    return groups.map((group) => ({
      title: (
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <TeamOutlined className="mr-2" />
            <span className="font-medium">{group.name}</span>
            {group.isOrganization && (
              <Tag color="orange" className="ml-2">
                组织
              </Tag>
            )}
            <Tag color="blue" className="ml-1">
              {group.members?.length || 0} 人
            </Tag>
          </div>
          <Space size="small">
            <Tooltip title="编辑群组">
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  handleEditGroup(group);
                }}
              />
            </Tooltip>
            <Tooltip title="管理成员">
              <Button
                type="text"
                size="small"
                icon={<UserOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  handleManageMembers(group);
                }}
              />
            </Tooltip>
          </Space>
        </div>
      ),
      key: group.id,
      children:
        group.children && group.children.length > 0
          ? buildTreeData(group.children)
          : undefined,
    }));
  };

  // 表格列定义
  const columns: ColumnsType<IGroupWithLevel> = [
    {
      title: "群组名称",
      dataIndex: "name",
      key: "name",
      sorter: (a, b) => a.name.localeCompare(b.name),
      render: (name: string, record: IGroupWithLevel) => (
        <div style={{ paddingLeft: (record.level || 0) * 20 }}>
          <span className="font-medium">{name}</span>
          {record.isOrganization && (
            <Tag color="orange" className="ml-2">
              组织
            </Tag>
          )}
        </div>
      ),
    },
    {
      title: "描述",
      dataIndex: "description",
      key: "description",
      render: (description: string) => description || "-",
      ellipsis: {
        showTitle: false,
      },
    },
    {
      title: "成员数量",
      dataIndex: "members",
      key: "memberCount",
      render: (members: any[]) => (
        <Tag color="blue">{members?.length || 0} 人</Tag>
      ),
    },
    {
      title: "父群组",
      dataIndex: "parent",
      key: "parent",
      render: (parent: IGroup) => parent?.name || "无",
    },
    {
      title: "创建时间",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 180,
      sorter: (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      render: (createdAt: string) =>
        new Date(createdAt).toLocaleString("zh-CN"),
    },
    {
      title: "操作",
      key: "actions",
      width: 150,
      render: (_, record: IGroupWithLevel) => (
        <Space size="small">
          <Tooltip title="编辑群组">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => handleEditGroup(record)}
            />
          </Tooltip>
          <Tooltip title="管理成员">
            <Button
              type="text"
              icon={<UserOutlined />}
              onClick={() => handleManageMembers(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  if (groupsError) {
    return (
      <Card>
        <div className="text-center text-red-500">
          加载群组数据时出错：{(groupsError as any)?.message}
        </div>
      </Card>
    );
  }

  return (
    <div className="p-6">
      <Card>
        <div className="mb-6">
          <div className="mb-4 flex items-center justify-between">
            <Title level={2} className="!mb-0">
              群组管理
            </Title>
            <Space>
              <Button
                type={viewMode === "tree" ? "primary" : "default"}
                onClick={() => setViewMode("tree")}
              >
                树形视图
              </Button>
              <Button
                type={viewMode === "table" ? "primary" : "default"}
                onClick={() => setViewMode("table")}
              >
                表格视图
              </Button>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => refetchGroups()}
                loading={groupsLoading}
              >
                刷新
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setIsGroupFormOpen(true)}
              >
                添加群组
              </Button>
            </Space>
          </div>

          <div className="flex items-center justify-between">
            <Search
              placeholder="搜索群组名称或描述"
              allowClear
              enterButton={<SearchOutlined />}
              size="large"
              style={{ width: 400 }}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
            <div className="text-gray-500">
              共 {filteredGroups.length} 个群组
            </div>
          </div>
        </div>

        {viewMode === "tree" ? (
          <Tree
            treeData={buildTreeData(groupTrees)}
            defaultExpandAll
            showLine
            blockNode
          />
        ) : (
          <Table
            columns={columns}
            dataSource={filteredGroups}
            rowKey="id"
            loading={groupsLoading}
            pagination={{
              total: filteredGroups.length,
              pageSize: 10,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) =>
                `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
            }}
            scroll={{ x: 1200 }}
          />
        )}
      </Card>

      {/* 群组表单弹窗 */}
      <Modal
        title={editingGroup ? "编辑群组" : "添加群组"}
        open={isGroupFormOpen}
        onCancel={() => {
          setIsGroupFormOpen(false);
          setEditingGroup(null);
        }}
        footer={null}
        width={600}
        destroyOnHidden
      >
        <GroupForm
          group={editingGroup}
          groups={allGroups}
          onSubmit={(
            data: ICreateGroupDto | ICreateRootOrgGroupDto | IUpdateGroupDto,
          ) => {
            if (editingGroup) {
              updateGroupMutation.mutate({
                id: editingGroup.id,
                data: data as IUpdateGroupDto,
              });
            } else {
              // 检查是否为根组织群组数据
              if ("parentId" in data) {
                // 普通群组创建（包含parentId）
                createGroupMutation.mutate(data as ICreateGroupDto);
              } else {
                // 根组织群组创建（不包含parentId）
                createRootOrgGroupMutation.mutate(
                  data as ICreateRootOrgGroupDto,
                );
              }
            }
          }}
          onCancel={() => {
            setIsGroupFormOpen(false);
            setEditingGroup(null);
          }}
          loading={
            createGroupMutation.isPending ||
            createRootOrgGroupMutation.isPending ||
            updateGroupMutation.isPending
          }
        />
      </Modal>

      {/* 成员管理弹窗 */}
      <Modal
        title={`管理群组成员 - ${selectedGroup?.name}`}
        open={isMemberManagementOpen}
        onCancel={() => {
          setIsMemberManagementOpen(false);
          setSelectedGroup(null);
        }}
        footer={null}
        width={800}
        destroyOnHidden
      >
        <GroupMemberManagement
          group={selectedGroup}
          users={users}
          onAddMembers={(data: IAddGroupMembersDto) => {
            if (selectedGroup) {
              addGroupMembersMutation.mutate({
                groupId: selectedGroup.id,
                data,
              });
            }
          }}
          onUpdateMember={(userId: string, data: IUpdateGroupMemberDto) => {
            if (selectedGroup) {
              updateGroupMemberMutation.mutate({
                groupId: selectedGroup.id,
                userId,
                data,
              });
            }
          }}
          onRemoveMember={(userId: string) => {
            if (selectedGroup) {
              removeGroupMemberMutation.mutate({
                groupId: selectedGroup.id,
                userId,
              });
            }
          }}
          loading={{
            addMembers: addGroupMembersMutation.isPending,
            updateMember: updateGroupMemberMutation.isPending,
            removeMember: removeGroupMemberMutation.isPending,
          }}
        />
      </Modal>
    </div>
  );
};
