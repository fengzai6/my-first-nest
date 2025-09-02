import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Form, Input, Select, Space, Switch } from "antd";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import type { ICreateUserDto, IUpdateUserDto } from "@/services/dtos/user";
import type { IRole } from "@/services/types/role";
import type { IUser } from "@/services/types/user";

const { Option } = Select;

// 表单验证schema
const createUserSchema = z.object({
  username: z
    .string()
    .min(1, "用户名不能为空")
    .min(3, "用户名至少3个字符")
    .max(50, "用户名不能超过50个字符"),
  email: z.string().email("请输入有效的邮箱地址"),
  password: z
    .string()
    .min(6, "密码至少6个字符")
    .max(100, "密码不能超过100个字符"),
  roles: z.array(z.string()).optional(),
});

const updateUserSchema = z.object({
  username: z
    .string()
    .min(1, "用户名不能为空")
    .min(3, "用户名至少3个字符")
    .max(50, "用户名不能超过50个字符")
    .optional(),
  email: z.string().email("请输入有效的邮箱地址").optional(),
  isActive: z.boolean().optional(),
});

type CreateUserFormData = z.infer<typeof createUserSchema>;
type UpdateUserFormData = z.infer<typeof updateUserSchema>;

interface IUserFormProps {
  user?: IUser | null;
  roles: IRole[];
  onSubmit: (data: ICreateUserDto | IUpdateUserDto) => void;
  onCancel: () => void;
  loading?: boolean;
}

export const UserForm: React.FC<IUserFormProps> = ({
  user,
  roles,
  onSubmit,
  onCancel,
  loading = false,
}) => {
  const isEdit = !!user;
  const schema = isEdit ? updateUserSchema : createUserSchema;

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateUserFormData | UpdateUserFormData>({
    resolver: zodResolver(schema),
    defaultValues: isEdit
      ? {
          username: user?.username || "",
          email: user?.email || "",
          isActive: user?.isActive ?? true,
        }
      : {
          username: "",
          email: "",
          password: "",
          roles: [],
        },
  });

  // 当用户数据变化时重置表单
  useEffect(() => {
    if (isEdit && user) {
      reset({
        username: user.username,
        email: user.email || "",
        isActive: user.isActive,
      });
    } else {
      reset({
        username: "",
        email: "",
        password: "",
        roles: [],
      });
    }
  }, [user, isEdit, reset]);

  const onFormSubmit = (data: CreateUserFormData | UpdateUserFormData) => {
    onSubmit(data);
  };

  return (
    <Form layout="vertical" onFinish={handleSubmit(onFormSubmit)}>
      <Form.Item
        label="用户名"
        validateStatus={errors.username ? "error" : ""}
        help={errors.username?.message}
        required={!isEdit}
      >
        <Controller
          name="username"
          control={control}
          render={({ field }) => (
            <Input
              {...field}
              placeholder="请输入用户名"
              size="large"
              disabled={loading}
            />
          )}
        />
      </Form.Item>

      <Form.Item
        label="邮箱"
        validateStatus={errors.email ? "error" : ""}
        help={errors.email?.message}
        required={!isEdit}
      >
        <Controller
          name="email"
          control={control}
          render={({ field }) => (
            <Input
              {...field}
              type="email"
              placeholder="请输入邮箱地址"
              size="large"
              disabled={loading}
            />
          )}
        />
      </Form.Item>

      {!isEdit && (
        <>
          <Form.Item
            label="密码"
            validateStatus={(errors as any).password ? "error" : ""}
            help={(errors as any).password?.message}
            required
          >
            <Controller
              name="password"
              control={control}
              render={({ field }) => (
                <Input.Password
                  {...field}
                  placeholder="请输入密码"
                  size="large"
                  disabled={loading}
                />
              )}
            />
          </Form.Item>

          <Form.Item label="角色" help="可选择多个角色">
            <Controller
              name="roles"
              control={control}
              render={({ field }) => (
                <Select
                  {...field}
                  mode="multiple"
                  placeholder="请选择角色"
                  size="large"
                  disabled={loading}
                  allowClear
                >
                  {roles.map((role) => (
                    <Option key={role.code} value={role.code}>
                      {role.name}
                    </Option>
                  ))}
                </Select>
              )}
            />
          </Form.Item>
        </>
      )}

      {isEdit && (
        <Form.Item label="状态">
          <Controller
            name="isActive"
            control={control}
            render={({ field: { onChange, value } }) => (
              <Switch
                checked={value}
                onChange={onChange}
                checkedChildren="启用"
                unCheckedChildren="禁用"
                disabled={loading}
              />
            )}
          />
        </Form.Item>
      )}

      <Form.Item className="mt-6 mb-0">
        <Space className="w-full justify-end">
          <Button onClick={onCancel} disabled={loading}>
            取消
          </Button>
          <Button type="primary" htmlType="submit" loading={loading}>
            {isEdit ? "更新" : "创建"}
          </Button>
        </Space>
      </Form.Item>
    </Form>
  );
};
