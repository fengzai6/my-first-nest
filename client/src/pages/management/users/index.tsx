import {
  DeleteOutlined,
  EditOutlined,
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
} from "@/services/api/user";
import type {
  IUpdatePasswordByAdminDto,
  IUpdateUserDto,
  IUpdateUserRolesDto,
} from "@/services/dtos/user";
import type { IUser } from "@/services/types/user";
import { PasswordResetForm, RoleAssignmentForm, UserForm } from "./components";

const { Title } = Typography;
const { Search } = Input;

export const Users = () => {
  const [searchText, setSearchText] = useState("");
  const [isUserFormOpen, setIsUserFormOpen] = useState(false);
  const [isPasswordResetOpen, setIsPasswordResetOpen] = useState(false);
  const [isRoleAssignmentOpen, setIsRoleAssignmentOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<IUser | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const queryClient = useQueryClient();

  // 获取用户列表
  const {
    data: users = [],
    isLoading: usersLoading,
    error: usersError,
    refetch: refetchUsers,
  } = useQuery({
    queryKey: ["users"],
    queryFn: GetUsers,
  });

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

  // 过滤用户数据
  const filteredUsers = users.filter(
    (user) =>
      user.username.toLowerCase().includes(searchText.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchText.toLowerCase()) ||
      user.displayName.toLowerCase().includes(searchText.toLowerCase()),
  );

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
      width: 200,
      render: (_, record: IUser) => (
        <Space size="small">
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
              onChange={(e) => setSearchText(e.target.value)}
            />
            <div className="text-gray-500">
              共 {filteredUsers.length} 个用户
            </div>
          </div>
        </div>

        <Table
          columns={columns}
          dataSource={filteredUsers}
          rowKey="id"
          loading={usersLoading}
          pagination={{
            total: filteredUsers.length,
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
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
          onCancel={() => {
            setIsRoleAssignmentOpen(false);
            setSelectedUserId(null);
          }}
          loading={updateUserRolesMutation.isPending}
        />
      </Modal>
    </div>
  );
};
