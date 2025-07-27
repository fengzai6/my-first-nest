import { AppSidebar } from "@/components/app-sidebar";
import { Button } from "@/components/ui/button";
import { SidebarProvider } from "@/components/ui/sidebar";
import { CreateUser } from "@/services/api/user";
import { GetRoles } from "@/services/api/role";
import type { ICreateUserDto } from "@/services/dtos/user";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Form, Input, Select, Card, message } from "antd";
import { useNavigate } from "react-router";
import { toast } from "sonner";

const { Option } = Select;

export const CreateUser = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();

  // 获取角色列表
  const { data: roles = [] } = useQuery({
    queryKey: ["roles"],
    queryFn: GetRoles,
  });

  // 创建用户
  const createMutation = useMutation({
    mutationFn: CreateUser,
    onSuccess: () => {
      message.success("用户创建成功");
      navigate("/users");
    },
    onError: (error) => {
      toast.error(error.message || "创建失败");
    },
  });

  const onFinish = (values: ICreateUserDto) => {
    createMutation.mutate(values);
  };

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
          <h1 className="text-2xl font-bold">新建用户</h1>
        </div>

        <Card>
          <Form
            form={form}
            layout="vertical"
            onFinish={onFinish}
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

            <Form.Item
              label="密码"
              name="password"
              rules={[
                { required: true, message: "请输入密码" },
                { min: 6, message: "密码至少6个字符" },
              ]}
            >
              <Input.Password placeholder="请输入密码" />
            </Form.Item>

            <Form.Item
              label="确认密码"
              name="confirmPassword"
              dependencies={["password"]}
              rules={[
                { required: true, message: "请确认密码" },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue("password") === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error("两次输入的密码不一致"));
                  },
                }),
              ]}
            >
              <Input.Password placeholder="请再次输入密码" />
            </Form.Item>

            <Form.Item label="昵称" name="nickname">
              <Input placeholder="请输入昵称（可选）" />
            </Form.Item>

            <Form.Item label="角色" name="roles">
              <Select
                mode="multiple"
                placeholder="请选择角色（可选）"
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
                  loading={createMutation.isPending}
                >
                  创建用户
                </Button>
                <Button onClick={() => navigate("/users")}>取消</Button>
              </div>
            </Form.Item>
          </Form>
        </Card>
      </div>
    </SidebarProvider>
  );
};