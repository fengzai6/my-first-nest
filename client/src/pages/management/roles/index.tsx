import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Card,
  Input,
  message,
  Modal,
  Popconfirm,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useState } from "react";

import { GetPermissions } from "@/services/api/permission";
import {
  CreateRole,
  DeleteRole,
  GetRoles,
  UpdateRole,
} from "@/services/api/role";
import type { ICreateRoleDto, IUpdateRoleDto } from "@/services/dtos/role";
import type { IRole } from "@/services/types/role";
import { RoleForm } from "./components";

const { Title } = Typography;
const { Search } = Input;

export const Roles = () => {
  const [searchText, setSearchText] = useState("");
  const [isRoleFormOpen, setIsRoleFormOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<IRole | null>(null);

  const queryClient = useQueryClient();

  // 获取角色列表
  const {
    data: roles = [],
    isLoading: rolesLoading,
    error: rolesError,
    refetch: refetchRoles,
  } = useQuery({
    queryKey: ["roles"],
    queryFn: GetRoles,
  });

  // 获取权限列表
  const { data: permissions = [] } = useQuery({
    queryKey: ["permissions"],
    queryFn: GetPermissions,
  });

  // 创建角色
  const createRoleMutation = useMutation({
    mutationFn: CreateRole,
    onSuccess: () => {
      message.success("角色创建成功");
      setIsRoleFormOpen(false);
      queryClient.invalidateQueries({ queryKey: ["roles"] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || "创建角色失败");
    },
  });

  // 更新角色
  const updateRoleMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: IUpdateRoleDto }) =>
      UpdateRole(id, data),
    onSuccess: () => {
      message.success("角色更新成功");
      setIsRoleFormOpen(false);
      setEditingRole(null);
      queryClient.invalidateQueries({ queryKey: ["roles"] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || "更新角色失败");
    },
  });

  // 删除角色
  const deleteRoleMutation = useMutation({
    mutationFn: DeleteRole,
    onSuccess: () => {
      message.success("角色删除成功");
      queryClient.invalidateQueries({ queryKey: ["roles"] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || "删除角色失败");
    },
  });

  // 过滤角色数据
  const filteredRoles = roles.filter(
    (role) =>
      role.name.toLowerCase().includes(searchText.toLowerCase()) ||
      role.code.toLowerCase().includes(searchText.toLowerCase()) ||
      role.description?.toLowerCase().includes(searchText.toLowerCase()),
  );

  // 处理编辑角色
  const handleEditRole = (role: IRole) => {
    setEditingRole(role);
    setIsRoleFormOpen(true);
  };

  // 处理删除角色
  const handleDeleteRole = (roleId: string) => {
    deleteRoleMutation.mutate(roleId);
  };

  // 表格列定义
  const columns: ColumnsType<IRole> = [
    {
      title: "角色名称",
      dataIndex: "name",
      key: "name",
      sorter: (a, b) => a.name.localeCompare(b.name),
      render: (name: string) => <span className="font-medium">{name}</span>,
    },
    {
      title: "角色编码",
      dataIndex: "code",
      key: "code",
      sorter: (a, b) => a.code.localeCompare(b.code),
      render: (code: string) => <Tag color="geekblue">{code}</Tag>,
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
      title: "权限数量",
      dataIndex: "permissions",
      key: "permissionCount",
      render: (permissions: any[]) => (
        <Tag color="blue">{permissions?.length || 0} 个权限</Tag>
      ),
    },
    {
      title: "权限列表",
      dataIndex: "permissions",
      key: "permissions",
      width: 300,
      render: (permissions: any[]) => (
        <div className="max-h-20 overflow-y-auto">
          <Space wrap size="small">
            {permissions?.slice(0, 5).map((permission) => (
              <Tag key={permission.id} color="cyan">
                {permission.name}
              </Tag>
            ))}
            {permissions?.length > 5 && (
              <Tag color="default">+{permissions.length - 5} 更多</Tag>
            )}
          </Space>
        </div>
      ),
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
      width: 120,
      render: (_, record: IRole) => (
        <Space size="small">
          <Tooltip title="编辑角色">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => handleEditRole(record)}
            />
          </Tooltip>
          <Popconfirm
            title="确认删除"
            description="确定要删除这个角色吗？此操作无法撤销。"
            onConfirm={() => handleDeleteRole(record.id)}
            okText="确认"
            cancelText="取消"
          >
            <Tooltip title="删除角色">
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                loading={deleteRoleMutation.isPending}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (rolesError) {
    return (
      <Card>
        <div className="text-center text-red-500">
          加载角色数据时出错：{(rolesError as any)?.message}
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
              角色管理
            </Title>
            <Space>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => refetchRoles()}
                loading={rolesLoading}
              >
                刷新
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setIsRoleFormOpen(true)}
              >
                添加角色
              </Button>
            </Space>
          </div>

          <div className="flex items-center justify-between">
            <Search
              placeholder="搜索角色名称、编码或描述"
              allowClear
              enterButton={<SearchOutlined />}
              size="large"
              style={{ width: 400 }}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
            <div className="text-gray-500">
              共 {filteredRoles.length} 个角色
            </div>
          </div>
        </div>

        <Table
          columns={columns}
          dataSource={filteredRoles}
          rowKey="id"
          loading={rolesLoading}
          pagination={{
            total: filteredRoles.length,
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
          }}
          scroll={{ x: 1200 }}
        />
      </Card>

      {/* 角色表单弹窗 */}
      <Modal
        title={editingRole ? "编辑角色" : "添加角色"}
        open={isRoleFormOpen}
        onCancel={() => {
          setIsRoleFormOpen(false);
          setEditingRole(null);
        }}
        footer={null}
        width={700}
        destroyOnHidden
      >
        <RoleForm
          role={editingRole}
          permissions={permissions}
          onSubmit={(data: ICreateRoleDto | IUpdateRoleDto) => {
            if (editingRole) {
              updateRoleMutation.mutate({
                id: editingRole.id,
                data: data as IUpdateRoleDto,
              });
            } else {
              createRoleMutation.mutate(data as ICreateRoleDto);
            }
          }}
          onCancel={() => {
            setIsRoleFormOpen(false);
            setEditingRole(null);
          }}
          loading={createRoleMutation.isPending || updateRoleMutation.isPending}
        />
      </Modal>
    </div>
  );
};
