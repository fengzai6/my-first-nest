import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  KeyOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Avatar,
  Button,
  Card,
  Descriptions,
  Divider,
  Drawer,
  Input,
  message,
  Modal,
  Popconfirm,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useState } from "react";

import { GetRoles } from "@/services/api/role";
import {
  CreateUser,
  GetUsers,
  RemoveUser,
  UpdateUser,
  UpdateUserPasswordByAdmin,
  UpdateUserRoles,
  UpdateUserSpecialRoles,
} from "@/services/api/user";
import type {
  IUpdatePasswordByAdminDto,
  IUpdateUserDto,
  IUpdateUserRolesDto,
  IUpdateUserSpecialRolesDto,
} from "@/services/dtos/user";
import type { IUser } from "@/services/types/user";
import { PasswordResetForm, RoleAssignmentForm, UserForm } from "./components";

const { Title } = Typography;
const { Search } = Input;

export const Users = () => {
  const [searchText, setSearchText] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isUserFormOpen, setIsUserFormOpen] = useState(false);
  const [isPasswordResetOpen, setIsPasswordResetOpen] = useState(false);
  const [isRoleAssignmentOpen, setIsRoleAssignmentOpen] = useState(false);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<IUser | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [viewingUser, setViewingUser] = useState<IUser | null>(null);

  const queryClient = useQueryClient();

  // 用户列表 —— 服务端分页 + 搜索：搜索关键字、页码、每页数量都作为 queryKey 一部分，
  // react-query 会在任一变化时自动重取，避免客户端全量加载导致内存与网络浪费。
  const {
    data: usersPage,
    isLoading: usersLoading,
    error: usersError,
    refetch: refetchUsers,
  } = useQuery({
    queryKey: ["users", { page, pageSize, search: searchText }],
    queryFn: () =>
      GetUsers({ page, pageSize, search: searchText || undefined }),
    placeholderData: (prev) => prev,
  });

  const users = usersPage?.list ?? [];
  const total = usersPage?.total ?? 0;

  // 获取角色列表
  const { data: roles = [] } = useQuery({
    queryKey: ["roles"],
    queryFn: GetRoles,
  });

  // 创建用户
  const createUserMutation = useMutation({
    mutationFn: CreateUser,
    onSuccess: () => {
      message.success("用户创建成功");
      setIsUserFormOpen(false);
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || "创建用户失败");
    },
  });

  // 更新用户
  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: IUpdateUserDto }) =>
      UpdateUser(id, data),
    onSuccess: () => {
      message.success("用户更新成功");
      setIsUserFormOpen(false);
      setEditingUser(null);
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || "更新用户失败");
    },
  });

  // 删除用户
  const deleteUserMutation = useMutation({
    mutationFn: RemoveUser,
    onSuccess: () => {
      message.success("用户删除成功");
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || "删除用户失败");
    },
  });

  // 重置密码
  const resetPasswordMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: IUpdatePasswordByAdminDto;
    }) => UpdateUserPasswordByAdmin(id, data),
    onSuccess: () => {
      message.success("密码重置成功");
      setIsPasswordResetOpen(false);
      setSelectedUserId(null);
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || "密码重置失败");
    },
  });

  // 更新用户角色
  const updateUserRolesMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: IUpdateUserRolesDto }) =>
      UpdateUserRoles(id, data),
    onSuccess: () => {
      message.success("角色分配成功");
      setIsRoleAssignmentOpen(false);
      setSelectedUserId(null);
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || "角色分配失败");
    },
  });

  // 更新用户特殊角色
  const updateUserSpecialRolesMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: IUpdateUserSpecialRolesDto;
    }) => UpdateUserSpecialRoles(id, data),
    onSuccess: () => {
      message.success("特殊角色更新成功");
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || "特殊角色更新失败");
    },
  });

  // 处理编辑用户
  const handleEditUser = (user: IUser) => {
    setEditingUser(user);
    setIsUserFormOpen(true);
  };

  // 处理删除用户
  const handleDeleteUser = (userId: string) => {
    deleteUserMutation.mutate(userId);
  };

  // 处理重置密码
  const handleResetPassword = (userId: string) => {
    setSelectedUserId(userId);
    setIsPasswordResetOpen(true);
  };

  // 处理角色分配
  const handleAssignRoles = (userId: string) => {
    setSelectedUserId(userId);
    setIsRoleAssignmentOpen(true);
  };

  // 处理用户状态切换
  const handleToggleUserStatus = (user: IUser) => {
    updateUserMutation.mutate({
      id: user.id,
      data: { isActive: !user.isActive },
    });
  };

  // 处理查看详情
  const handleViewDetail = (user: IUser) => {
    setViewingUser(user);
    setIsDetailDrawerOpen(true);
  };

  // 表格列定义
  const columns: ColumnsType<IUser> = [
    {
      title: "头像",
      dataIndex: "avatar",
      key: "avatar",
      width: 80,
      render: (avatar: string, record: IUser) => (
        <Avatar src={avatar} icon={<UserOutlined />} alt={record.displayName} />
      ),
    },
    {
      title: "用户名",
      dataIndex: "username",
      key: "username",
      sorter: (a, b) => a.username.localeCompare(b.username),
    },
    {
      title: "显示名称",
      dataIndex: "displayName",
      key: "displayName",
      sorter: (a, b) => a.displayName.localeCompare(b.displayName),
    },
    {
      title: "邮箱",
      dataIndex: "email",
      key: "email",
      render: (email: string) => email || "-",
    },
    {
      title: "角色",
      dataIndex: "roles",
      key: "roles",
      render: (roles: any[]) => (
        <Space wrap>
          {roles?.map((role) => (
            <Tag key={role.id} color="blue">
              {role.name}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: "特殊角色",
      dataIndex: "specialRoles",
      key: "specialRoles",
      render: (specialRoles: string[]) => (
        <Space wrap>
          {specialRoles?.map((role) => (
            <Tag key={role} color="red">
              {role === "super_admin" ? "超级管理员" : "开发者"}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: "状态",
      dataIndex: "isActive",
      key: "isActive",
      render: (isActive: boolean, record: IUser) => (
        <Switch
          checked={isActive}
          onChange={() => handleToggleUserStatus(record)}
          loading={updateUserMutation.isPending}
        />
      ),
    },
    {
      title: "操作",
      key: "actions",
      width: 240,
      render: (_, record: IUser) => (
        <Space size="small">
          <Tooltip title="查看详情">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => handleViewDetail(record)}
            />
          </Tooltip>
          <Tooltip title="编辑用户">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => handleEditUser(record)}
            />
          </Tooltip>
          <Tooltip title="分配角色">
            <Button
              type="text"
              icon={<UserOutlined />}
              onClick={() => handleAssignRoles(record.id)}
            />
          </Tooltip>
          <Tooltip title="重置密码">
            <Button
              type="text"
              icon={<KeyOutlined />}
              onClick={() => handleResetPassword(record.id)}
            />
          </Tooltip>
          <Popconfirm
            title="确认删除"
            description="确定要删除这个用户吗？此操作无法撤销。"
            onConfirm={() => handleDeleteUser(record.id)}
            okText="确认"
            cancelText="取消"
          >
            <Tooltip title="删除用户">
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                loading={deleteUserMutation.isPending}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (usersError) {
    return (
      <Card>
        <div className="text-center text-red-500">
          加载用户数据时出错：{(usersError as any)?.message}
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
              用户管理
            </Title>
            <Space>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => refetchUsers()}
                loading={usersLoading}
              >
                刷新
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setIsUserFormOpen(true)}
              >
                添加用户
              </Button>
            </Space>
          </div>

          <div className="flex items-center justify-between">
            <Search
              placeholder="搜索用户名、邮箱或显示名称"
              allowClear
              enterButton={<SearchOutlined />}
              size="large"
              style={{ width: 400 }}
              value={searchText}
              onChange={(e) => {
                setSearchText(e.target.value);
                setPage(1);
              }}
            />
            <div className="text-gray-500">共 {total} 个用户</div>
          </div>
        </div>

        <Table
          columns={columns}
          dataSource={users}
          rowKey="id"
          loading={usersLoading}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (t, range) =>
              `第 ${range[0]}-${range[1]} 条，共 ${t} 条`,
            onChange: (nextPage, nextPageSize) => {
              setPage(nextPage);
              setPageSize(nextPageSize);
            },
          }}
          scroll={{ x: 1200 }}
        />
      </Card>

      {/* 用户表单弹窗 */}
      <Modal
        title={editingUser ? "编辑用户" : "添加用户"}
        open={isUserFormOpen}
        onCancel={() => {
          setIsUserFormOpen(false);
          setEditingUser(null);
        }}
        footer={null}
        width={600}
        destroyOnHidden
      >
        <UserForm
          user={editingUser}
          roles={roles}
          onSubmit={(data) => {
            if (editingUser) {
              updateUserMutation.mutate({
                id: editingUser.id,
                data: data as IUpdateUserDto,
              });
            } else {
              createUserMutation.mutate(data as any);
            }
          }}
          onCancel={() => {
            setIsUserFormOpen(false);
            setEditingUser(null);
          }}
          loading={createUserMutation.isPending || updateUserMutation.isPending}
        />
      </Modal>

      {/* 密码重置弹窗 */}
      <Modal
        title="重置密码"
        open={isPasswordResetOpen}
        onCancel={() => {
          setIsPasswordResetOpen(false);
          setSelectedUserId(null);
        }}
        footer={null}
        width={400}
        destroyOnHidden
      >
        <PasswordResetForm
          onSubmit={(data: IUpdatePasswordByAdminDto) => {
            if (selectedUserId) {
              resetPasswordMutation.mutate({ id: selectedUserId, data });
            }
          }}
          onCancel={() => {
            setIsPasswordResetOpen(false);
            setSelectedUserId(null);
          }}
          loading={resetPasswordMutation.isPending}
        />
      </Modal>

      {/* 角色分配弹窗 */}
      <Modal
        title="分配角色"
        open={isRoleAssignmentOpen}
        onCancel={() => {
          setIsRoleAssignmentOpen(false);
          setSelectedUserId(null);
        }}
        footer={null}
        width={500}
        destroyOnHidden
      >
        <RoleAssignmentForm
          userId={selectedUserId}
          user={users.find((u) => u.id === selectedUserId)}
          roles={roles}
          onSubmit={(data: IUpdateUserRolesDto) => {
            if (selectedUserId) {
              updateUserRolesMutation.mutate({ id: selectedUserId, data });
            }
          }}
          onSubmitSpecialRoles={(data: IUpdateUserSpecialRolesDto) => {
            if (selectedUserId) {
              updateUserSpecialRolesMutation.mutate({
                id: selectedUserId,
                data,
              });
            }
          }}
          onCancel={() => {
            setIsRoleAssignmentOpen(false);
            setSelectedUserId(null);
          }}
          loading={
            updateUserRolesMutation.isPending ||
            updateUserSpecialRolesMutation.isPending
          }
        />
      </Modal>

      {/* 用户详情抽屉 */}
      <Drawer
        title="用户详情"
        open={isDetailDrawerOpen}
        onClose={() => {
          setIsDetailDrawerOpen(false);
          setViewingUser(null);
        }}
        width={500}
      >
        {viewingUser && (
          <div>
            <div className="mb-6 flex items-center space-x-4">
              <Avatar
                size={64}
                src={viewingUser.avatar}
                icon={<UserOutlined />}
              />
              <div>
                <div className="text-xl font-semibold">
                  {viewingUser.displayName}
                </div>
                <div className="text-gray-500">@{viewingUser.username}</div>
              </div>
            </div>

            <Divider />

            <Descriptions column={1} labelStyle={{ fontWeight: "bold" }}>
              <Descriptions.Item label="用户 ID">
                {viewingUser.id}
              </Descriptions.Item>
              <Descriptions.Item label="邮箱">
                {viewingUser.email || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="昵称">
                {viewingUser.nickname || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={viewingUser.isActive ? "green" : "red"}>
                  {viewingUser.isActive ? "正常" : "禁用"}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {new Date(viewingUser.createdAt).toLocaleString("zh-CN")}
              </Descriptions.Item>
              <Descriptions.Item label="更新时间">
                {new Date(viewingUser.updatedAt).toLocaleString("zh-CN")}
              </Descriptions.Item>
            </Descriptions>

            <Divider />

            <div className="mb-4">
              <div className="mb-2 font-bold">普通角色</div>
              <Space wrap>
                {viewingUser.roles && viewingUser.roles.length > 0 ? (
                  viewingUser.roles.map((role) => (
                    <Tag key={role.id} color="blue">
                      {role.name}
                    </Tag>
                  ))
                ) : (
                  <span className="text-gray-500">暂无角色</span>
                )}
              </Space>
            </div>

            <div className="mb-4">
              <div className="mb-2 font-bold">特殊角色</div>
              <Space wrap>
                {viewingUser.specialRoles &&
                viewingUser.specialRoles.length > 0 ? (
                  viewingUser.specialRoles.map((role) => (
                    <Tag key={role} color="red">
                      {role === "super_admin" ? "超级管理员" : "开发者"}
                    </Tag>
                  ))
                ) : (
                  <span className="text-gray-500">暂无特殊角色</span>
                )}
              </Space>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
};
