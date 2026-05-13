import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Form, Input, Space } from "antd";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import type { IUpdateUserDto } from "@/services/dtos/user";
import type { IUser } from "@/services/types/user";

const profileSchema = z.object({
  username: z
    .string()
    .min(2, "用户名至少2个字符")
    .max(50, "用户名不能超过50个字符"),
  email: z.string().email("请输入有效的邮箱地址"),
});

type ProfileFormData = z.infer<typeof profileSchema>;

interface IProfileFormProps {
  user: IUser;
  onSubmit: (data: IUpdateUserDto) => void;
  loading?: boolean;
}

export const ProfileForm: React.FC<IProfileFormProps> = ({
  user,
  onSubmit,
  loading = false,
}) => {
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      username: user.username,
      email: user.email || "",
    },
  });

  const onFormSubmit = (data: ProfileFormData) => {
    onSubmit({
      username: data.username,
      email: data.email,
    });
  };

  return (
    <Form layout="vertical" onFinish={handleSubmit(onFormSubmit)}>
      <Form.Item label="用户 ID">
        <Input value={user.id} disabled />
      </Form.Item>

      <Form.Item
        label="用户名"
        validateStatus={errors.username ? "error" : ""}
        help={errors.username?.message}
        required
      >
        <Controller
          name="username"
          control={control}
          render={({ field }) => (
            <Input {...field} placeholder="请输入用户名" disabled={loading} />
          )}
        />
      </Form.Item>

      <Form.Item
        label="邮箱"
        validateStatus={errors.email ? "error" : ""}
        help={errors.email?.message}
        required
      >
        <Controller
          name="email"
          control={control}
          render={({ field }) => (
            <Input {...field} placeholder="请输入邮箱" disabled={loading} />
          )}
        />
      </Form.Item>

      <Form.Item label="显示名称">
        <Input value={user.displayName} disabled />
      </Form.Item>

      <Form.Item label="昵称">
        <Input value={user.nickname || "-"} disabled />
      </Form.Item>

      <Form.Item className="mt-6 mb-0">
        <Space className="w-full justify-end">
          <Button type="primary" htmlType="submit" loading={loading}>
            保存修改
          </Button>
        </Space>
      </Form.Item>
    </Form>
  );
};
