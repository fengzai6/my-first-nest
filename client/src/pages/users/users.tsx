import { AppSidebar } from "@/components/app-sidebar";
import { Button } from "@/components/ui/button";
import { SidebarProvider } from "@/components/ui/sidebar";
import { GetUsers, RemoveUser } from "@/services/api/user";
import type { IUser } from "@/services/types/user";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Table, Space, Modal, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

export const Users = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<IUser | null>(null);

  // 获取用户列表
  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: GetUsers,
  });

  // 删除用户
  const deleteMutation = useMutation({
    mutationFn: RemoveUser,
    onSuccess: () => {
      message.success("用户删除成功");
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setDeleteModalOpen(false);
      setUserToDelete(null);
    },
    onError: (error) => {
      toast.error(error.message || "删除失败");
    },
  });

  const handleDelete = (user: IUser) => {
    setUserToDelete(user);
    setDeleteModalOpen(true);
  };

  const confirmDelete = () => {
    if (userToDelete) {
      deleteMutation.mutate(userToDelete.id);
    }
  };

  const columns: ColumnsType<IUser> = [
    {
      title: "ID",
      dataIndex: "id",
      key: "id",
      width: 200,
    },
    {
      title: "用户名",
      dataIndex: "username",
      key: "username",
    },
    {
      title: "邮箱",
      dataIndex: "email",
      key: "email",
    },
    {
      title: "昵称",
      dataIndex: "nickname",
      key: "nickname",
    },
    {
      title: "角色",
      dataIndex: "roles",
      key: "roles",
      render: (roles) => {
        if (!roles || roles.length === 0) return "-";
        return roles.map((role: any) => role.name).join(", ");
      },
    },
    {
      title: "特殊角色",
      dataIndex: "specialRoles",
      key: "specialRoles",
      render: (specialRoles) => {
        if (!specialRoles || specialRoles.length === 0) return "-";
        return specialRoles.join(", ");
      },
    },
    {
      title: "创建时间",
      dataIndex: "createdAt",
      key: "createdAt",
      render: (date) => new Date(date).toLocaleString(),
    },
    {
      title: "操作",
      key: "action",
      render: (_, record) => (
        <Space size="middle">
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => navigate(`/users/${record.id}/edit`)}
          >
            编辑
          </Button>
          <Button
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <SidebarProvider>
      <AppSidebar />
      <div className="flex-1 p-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">用户管理</h1>
          <Button
            className="bg-blue-500 hover:bg-blue-600"
            icon={<PlusOutlined />}
            onClick={() => navigate("/users/create")}
          >
            新建用户
          </Button>
        </div>

        <Table
          columns={columns}
          dataSource={users}
          rowKey="id"
          loading={isLoading}
          pagination={{
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`,
          }}
        />

        <Modal
          title="确认删除"
          open={deleteModalOpen}
          onOk={confirmDelete}
          onCancel={() => {
            setDeleteModalOpen(false);
            setUserToDelete(null);
          }}
          confirmLoading={deleteMutation.isPending}
          okText="确认删除"
          cancelText="取消"
          okType="danger"
        >
          <p>
            确定要删除用户 <strong>{userToDelete?.username}</strong> 吗？
          </p>
          <p className="text-gray-500">此操作不可恢复。</p>
        </Modal>
      </div>
    </SidebarProvider>
  );
};