import { AppSidebar } from "@/components/app-sidebar";
import { Button } from "@/components/ui/button";
import { SidebarProvider } from "@/components/ui/sidebar";
import { GetUser, UpdateUser, UpdateUserRoles } from "@/services/api/user";
import { GetRoles } from "@/services/api/role";
import type { IUpdateUserDto, IUpdateUserRolesDto } from "@/services/dtos/user";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Form, Input, Select, Card, message, Tabs } from "antd";
import { useEffect } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";

const { Option } = Select;
const { TabPane } = Tabs;

export const EditUser = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [basicForm] = Form.useForm();
  const [roleForm] = Form.useForm();

  if (!id) {
    navigate("/users");
    return null;
  }

  // 获取用户详情
  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ["user", id],
    queryFn: () => GetUser(id),
  });

  // 获取角色列表
  const { data: roles = [] } = useQuery({
    queryKey: ["roles"],
    queryFn: GetRoles,
  });

  // 更新用户基本信息
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: IUpdateUserDto }) =>
      UpdateUser(id, data),
    onSuccess: () => {
      message.success("用户信息更新成功");
      queryClient.invalidateQueries({ queryKey: ["user", id] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error) => {
      toast.error(error.message || "更新失败");
    },
  });

  // 更新用户角色
  const updateRolesMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: IUpdateUserRolesDto }) =>
      UpdateUserRoles(id, data),
    onSuccess: () => {
      message.success("用户角色更新成功");
      queryClient.invalidateQueries({ queryKey: ["user", id] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error) => {
      toast.error(error.message || "角色更新失败");
    },
  });

  // 初始化表单数据
  useEffect(() => {
    if (user) {
      basicForm.setFieldsValue({
        username: user.username,
        email: user.email,
        nickname: user.nickname,
      });

      roleForm.setFieldsValue({
        roles: user.roles?.map((role) => role.code) || [],
      });
    }
  }, [user, basicForm, roleForm]);

  const onBasicFinish = (values: IUpdateUserDto) => {
    updateMutation.mutate({ id, data: values });
  };

  const onRoleFinish = (values: IUpdateUserRolesDto) => {
    updateRolesMutation.mutate({ id, data: values });
  };

  if (userLoading) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <div className="flex-1 p-6">
          <div className="text-center">加载中...</div>
        </div>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <div className="flex-1 p-6">
        <div className="mb-6 flex items-center">
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate("/users")}
            className="mr-4"
          >
            返回
          </Button>
          <h1 className="text-2xl font-bold">编辑用户</h1>
        </div>

        <Card>
          <Tabs defaultActiveKey="basic">
            <TabPane tab="基本信息" key="basic">
              <Form
                form={basicForm}
                layout="vertical"
                onFinish={onBasicFinish}
                autoComplete="off"
                style={{ maxWidth: 600 }}
              >
                <Form.Item
                  label="用户名"
                  name="username"
                  rules={[
                    { required: true, message: "请输入用户名" },
                    { min: 3, message: "用户名至少3个字符" },
                    { max: 20, message: "用户名最多20个字符" },
                  ]}
                >
                  <Input placeholder="请输入用户名" />
                </Form.Item>

                <Form.Item
                  label="邮箱"
                  name="email"
                  rules={[
                    { required: true, message: "请输入邮箱" },
                    { type: "email", message: "请输入有效的邮箱地址" },
                  ]}
                >
                  <Input placeholder="请输入邮箱" />
                </Form.Item>

                <Form.Item label="昵称" name="nickname">
                  <Input placeholder="请输入昵称（可选）" />
                </Form.Item>

                <Form.Item>
                  <div className="flex gap-4">
                    <Button
                      className="bg-blue-500 hover:bg-blue-600"
                      htmlType="submit"
                      loading={updateMutation.isPending}
                    >
                      更新基本信息
                    </Button>
                    <Button onClick={() => navigate("/users")}>取消</Button>
                  </div>
                </Form.Item>
              </Form>
            </TabPane>

            <TabPane tab="角色管理" key="roles">
              <Form
                form={roleForm}
                layout="vertical"
                onFinish={onRoleFinish}
                autoComplete="off"
                style={{ maxWidth: 600 }}
              >
                <Form.Item label="角色" name="roles">
                  <Select
                    mode="multiple"
                    placeholder="请选择角色"
                    allowClear
                  >
                    {roles.map((role) => (
                      <Option key={role.code} value={role.code}>
                        {role.name}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>

                <Form.Item>
                  <div className="flex gap-4">
                    <Button
                      className="bg-blue-500 hover:bg-blue-600"
                      htmlType="submit"
                      loading={updateRolesMutation.isPending}
                    >
                      更新角色
                    </Button>
                    <Button onClick={() => navigate("/users")}>取消</Button>
                  </div>
                </Form.Item>
              </Form>
            </TabPane>
          </Tabs>
        </Card>
      </div>
    </SidebarProvider>
  );
};