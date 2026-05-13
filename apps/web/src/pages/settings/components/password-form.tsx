import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Form, Input, Space } from "antd";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import type { IUpdatePasswordDto } from "@/services/dtos/user";

const passwordSchema = z
  .object({
    oldPassword: z.string().min(1, "请输入当前密码"),
    newPassword: z
      .string()
      .min(8, "密码至少8个字符")
      .max(100, "密码不能超过100个字符"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "两次输入的密码不匹配",
    path: ["confirmPassword"],
  });

type PasswordFormData = z.infer<typeof passwordSchema>;

interface IPasswordFormProps {
  onSubmit: (data: IUpdatePasswordDto) => void;
  loading?: boolean;
}

export const PasswordForm: React.FC<IPasswordFormProps> = ({
  onSubmit,
  loading = false,
}) => {
  const {
    control,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      oldPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const newPassword = watch("newPassword");

  const onFormSubmit = (data: PasswordFormData) => {
    onSubmit({
      oldPassword: data.oldPassword,
      newPassword: data.newPassword,
    });
  };

  return (
    <Form layout="vertical" onFinish={handleSubmit(onFormSubmit)}>
      <Form.Item
        label="当前密码"
        validateStatus={errors.oldPassword ? "error" : ""}
        help={errors.oldPassword?.message}
        required
      >
        <Controller
          name="oldPassword"
          control={control}
          render={({ field }) => (
            <Input.Password
              {...field}
              placeholder="请输入当前密码"
              disabled={loading}
            />
          )}
        />
      </Form.Item>

      <Form.Item
        label="新密码"
        validateStatus={errors.newPassword ? "error" : ""}
        help={errors.newPassword?.message}
        required
      >
        <Controller
          name="newPassword"
          control={control}
          render={({ field }) => (
            <Input.Password
              {...field}
              placeholder="请输入新密码"
              disabled={loading}
            />
          )}
        />
      </Form.Item>

      <Form.Item
        label="确认新密码"
        validateStatus={errors.confirmPassword ? "error" : ""}
        help={errors.confirmPassword?.message}
        required
      >
        <Controller
          name="confirmPassword"
          control={control}
          render={({ field }) => (
            <Input.Password
              {...field}
              placeholder="请再次输入新密码"
              disabled={loading}
            />
          )}
        />
      </Form.Item>

      {newPassword && (
        <div className="mb-4">
          <div className="mb-2 text-sm text-gray-600">密码强度：</div>
          <div className="flex gap-1">
            <div
              className={`h-2 flex-1 rounded ${
                newPassword.length >= 6 ? "bg-red-400" : "bg-gray-200"
              }`}
            />
            <div
              className={`h-2 flex-1 rounded ${
                newPassword.length >= 8 && /[A-Z]/.test(newPassword)
                  ? "bg-yellow-400"
                  : "bg-gray-200"
              }`}
            />
            <div
              className={`h-2 flex-1 rounded ${
                newPassword.length >= 8 &&
                /[A-Z]/.test(newPassword) &&
                /[0-9]/.test(newPassword) &&
                /[^A-Za-z0-9]/.test(newPassword)
                  ? "bg-green-400"
                  : "bg-gray-200"
              }`}
            />
          </div>
          <div className="mt-1 text-xs text-gray-500">
            建议：至少8位，包含大小写字母、数字和特殊字符
          </div>
        </div>
      )}

      <Form.Item className="mt-6 mb-0">
        <Space className="w-full justify-end">
          <Button type="primary" htmlType="submit" loading={loading}>
            修改密码
          </Button>
        </Space>
      </Form.Item>
    </Form>
  );
};
