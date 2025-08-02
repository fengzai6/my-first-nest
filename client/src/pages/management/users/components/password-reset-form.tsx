import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Button, Form, Input, Space } from "antd";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import type { IUpdatePasswordByAdminDto } from "@/services/dtos/user";

// 表单验证schema
const passwordResetSchema = z
  .object({
    newPassword: z
      .string()
      .min(6, "密码至少6个字符")
      .max(100, "密码不能超过100个字符"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "两次输入的密码不匹配",
    path: ["confirmPassword"],
  });

type PasswordResetFormData = z.infer<typeof passwordResetSchema>;

interface PasswordResetFormProps {
  onSubmit: (data: IUpdatePasswordByAdminDto) => void;
  onCancel: () => void;
  loading?: boolean;
}

export const PasswordResetForm: React.FC<PasswordResetFormProps> = ({
  onSubmit,
  onCancel,
  loading = false,
}) => {
  const {
    control,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<PasswordResetFormData>({
    resolver: zodResolver(passwordResetSchema),
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
  });

  const newPassword = watch("newPassword");

  const onFormSubmit = (data: PasswordResetFormData) => {
    onSubmit({
      newPassword: data.newPassword,
    });
  };

  return (
    <div>
      <Alert
        message="密码重置提醒"
        description="重置后，用户需要使用新密码重新登录。请确保将新密码安全地传达给用户。"
        type="info"
        showIcon
        className="mb-4"
      />

      <Form layout="vertical" onFinish={handleSubmit(onFormSubmit)}>
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
                size="large"
                disabled={loading}
              />
            )}
          />
        </Form.Item>

        <Form.Item
          label="确认密码"
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
                size="large"
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
            <Button onClick={onCancel} disabled={loading}>
              取消
            </Button>
            <Button type="primary" htmlType="submit" loading={loading}>
              重置密码
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </div>
  );
};
