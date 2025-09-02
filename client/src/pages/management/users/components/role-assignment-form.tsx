import { zodResolver } from "@hookform/resolvers/zod";
import {
  Alert,
  Button,
  Checkbox,
  Divider,
  Form,
  Select,
  Space,
  Tag,
} from "antd";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import type { IUpdateUserRolesDto } from "@/services/dtos/user";
import type { IRole } from "@/services/types/role";
import type { IUser } from "@/services/types/user";
import { SpecialRoles as SpecialRolesEnum } from "@/services/types/user";

// 表单验证schema
const roleAssignmentSchema = z.object({
  roles: z.array(z.string()),
  specialRoles: z.array(z.string()),
});

type RoleAssignmentFormData = z.infer<typeof roleAssignmentSchema>;

interface IRoleAssignmentFormProps {
  userId: string | null;
  user?: IUser;
  roles: IRole[];
  onSubmit: (data: IUpdateUserRolesDto) => void;
  onCancel: () => void;
  loading?: boolean;
}

export const RoleAssignmentForm: React.FC<IRoleAssignmentFormProps> = ({
  userId,
  user,
  roles,
  onSubmit,
  onCancel,
  loading = false,
}) => {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
    watch,
  } = useForm<RoleAssignmentFormData>({
    resolver: zodResolver(roleAssignmentSchema),
    defaultValues: {
      roles: [],
      specialRoles: [],
    },
  });

  const selectedRoles = watch("roles");
  const selectedSpecialRoles = watch("specialRoles");

  // 当用户数据变化时重置表单
  useEffect(() => {
    if (user) {
      reset({
        roles: user.roles?.map((role) => role.code) || [],
        specialRoles: user.specialRoles || [],
      });
    }
  }, [user, reset]);

  const onFormSubmit = (data: RoleAssignmentFormData) => {
    onSubmit({
      roles: data.roles,
    });
  };

  // 获取选中角色的权限信息
  const getSelectedRolePermissions = () => {
    const selectedRoleObjects = roles.filter((role) =>
      selectedRoles.includes(role.code),
    );
    const allPermissions = selectedRoleObjects.flatMap(
      (role) => role.permissions || [],
    );
    // 去重
    const uniquePermissions = allPermissions.filter(
      (permission, index, self) =>
        index === self.findIndex((p) => p.code === permission.code),
    );
    return uniquePermissions;
  };

  const permissions = getSelectedRolePermissions();

  if (!userId) {
    return null;
  }

  return (
    <div>
      <Alert
        message="角色分配说明"
        description="为用户分配角色后，用户将获得相应的权限。特殊角色拥有系统级别的权限。"
        type="info"
        showIcon
        className="mb-4"
      />

      <Form layout="vertical" onFinish={handleSubmit(onFormSubmit)}>
        <Form.Item
          label="普通角色"
          validateStatus={errors.roles ? "error" : ""}
          help={errors.roles?.message}
        >
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
                showSearch
                optionFilterProp="label"
                options={roles.map((role) => ({
                  label: role.name,
                  value: role.code,
                }))}
              />
            )}
          />
        </Form.Item>

        <Form.Item label="特殊角色">
          <Controller
            name="specialRoles"
            control={control}
            render={({ field: { onChange, value } }) => (
              <Checkbox.Group
                value={value}
                onChange={onChange}
                disabled={loading}
              >
                <Space direction="vertical">
                  <Checkbox value={SpecialRolesEnum.SuperAdmin}>
                    <span className="font-medium text-red-600">超级管理员</span>
                    <span className="ml-2 text-xs text-gray-500">
                      拥有系统所有权限
                    </span>
                  </Checkbox>
                  <Checkbox value={SpecialRolesEnum.Developer}>
                    <span className="font-medium text-blue-600">开发者</span>
                    <span className="ml-2 text-xs text-gray-500">
                      拥有开发相关权限
                    </span>
                  </Checkbox>
                </Space>
              </Checkbox.Group>
            )}
          />
        </Form.Item>

        {selectedRoles.length > 0 && (
          <>
            <Divider />
            <Form.Item label="已选角色">
              <Space wrap>
                {selectedRoles.map((roleCode) => {
                  const role = roles.find((r) => r.code === roleCode);
                  return (
                    <Tag key={roleCode} color="blue">
                      {role?.name || roleCode}
                    </Tag>
                  );
                })}
              </Space>
            </Form.Item>
          </>
        )}

        {selectedSpecialRoles.length > 0 && (
          <Form.Item label="已选特殊角色">
            <Space wrap>
              {selectedSpecialRoles.map((roleCode) => (
                <Tag key={roleCode} color="red">
                  {roleCode === SpecialRolesEnum.SuperAdmin
                    ? "超级管理员"
                    : "开发者"}
                </Tag>
              ))}
            </Space>
          </Form.Item>
        )}

        {permissions.length > 0 && (
          <>
            <Divider />
            <Form.Item label={`权限预览 (${permissions.length} 个)`}>
              <div className="max-h-32 overflow-y-auto">
                <Space wrap>
                  {permissions.map((permission) => (
                    <Tag key={permission.code} color="green" className="mb-1">
                      {permission.name}
                    </Tag>
                  ))}
                </Space>
              </div>
            </Form.Item>
          </>
        )}

        <Form.Item className="mt-6 mb-0">
          <Space className="w-full justify-end">
            <Button onClick={onCancel} disabled={loading}>
              取消
            </Button>
            <Button type="primary" htmlType="submit" loading={loading}>
              确认分配
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </div>
  );
};
