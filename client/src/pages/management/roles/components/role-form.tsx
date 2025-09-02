import { Button, Checkbox, Form, Input, Space, Typography } from "antd";
import { useEffect, useState } from "react";

import type { ICreateRoleDto, IUpdateRoleDto } from "@/services/dtos/role";
import type { IPermission } from "@/services/types/permission";
import type { IRole } from "@/services/types/role";

const { TextArea } = Input;
const { Title } = Typography;

interface IRoleFormProps {
  role?: IRole | null;
  permissions: IPermission[];
  onSubmit: (data: ICreateRoleDto | IUpdateRoleDto) => void;
  onCancel: () => void;
  loading: boolean;
}

export const RoleForm: React.FC<IRoleFormProps> = ({
  role,
  permissions,
  onSubmit,
  onCancel,
  loading,
}) => {
  const [form] = Form.useForm();
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  useEffect(() => {
    if (role) {
      form.setFieldsValue({
        name: role.name,
        code: role.code,
        description: role.description,
      });
      setSelectedPermissions(role.permissions.map((p) => p.code));
    } else {
      form.resetFields();
      setSelectedPermissions([]);
    }
  }, [role, form]);

  const handleSubmit = () => {
    form.validateFields().then((values) => {
      const submitData = {
        name: values.name,
        description: values.description,
        permissions: selectedPermissions,
      };

      if (!role) {
        // 创建角色时需要code
        (submitData as ICreateRoleDto).code = values.code;
      }

      onSubmit(submitData);
    });
  };

  const handlePermissionChange = (checkedValues: any[]) => {
    setSelectedPermissions(checkedValues);
  };

  const handleSelectAll = () => {
    setSelectedPermissions(permissions.map((p) => p.code));
  };

  const handleSelectNone = () => {
    setSelectedPermissions([]);
  };

  return (
    <div className="py-4">
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        autoComplete="off"
      >
        <Form.Item
          label="角色名称"
          name="name"
          rules={[
            { required: true, message: "请输入角色名称" },
            { max: 50, message: "角色名称不能超过50个字符" },
          ]}
        >
          <Input placeholder="请输入角色名称" />
        </Form.Item>

        <Form.Item
          label="角色编码"
          name="code"
          rules={[
            { required: !role, message: "请输入角色编码" },
            {
              pattern: /^[a-zA-Z0-9_]+$/,
              message: "角色编码只能包含字母、数字和下划线",
            },
            { max: 50, message: "角色编码不能超过50个字符" },
          ]}
        >
          <Input
            placeholder="请输入角色编码"
            disabled={!!role}
            style={{ backgroundColor: role ? "#f5f5f5" : "white" }}
          />
        </Form.Item>

        <Form.Item
          label="描述"
          name="description"
          rules={[{ max: 200, message: "描述不能超过200个字符" }]}
        >
          <TextArea
            placeholder="请输入角色描述"
            rows={3}
            showCount
            maxLength={200}
          />
        </Form.Item>

        <Form.Item label="权限分配">
          <div className="rounded-lg border border-gray-200 p-4">
            <div className="mb-3 flex items-center justify-between">
              <Title level={5} className="!mb-0">
                选择权限 ({selectedPermissions.length}/{permissions.length})
              </Title>
              <Space>
                <Button
                  type="link"
                  size="small"
                  onClick={handleSelectAll}
                  disabled={selectedPermissions.length === permissions.length}
                >
                  全选
                </Button>
                <Button
                  type="link"
                  size="small"
                  onClick={handleSelectNone}
                  disabled={selectedPermissions.length === 0}
                >
                  清空
                </Button>
              </Space>
            </div>

            <Checkbox.Group
              value={selectedPermissions}
              onChange={handlePermissionChange}
              className="w-full"
            >
              <div className="grid max-h-60 grid-cols-1 gap-2 overflow-y-auto md:grid-cols-2">
                {permissions.map((permission) => (
                  <div key={permission.id} className="flex items-start">
                    <Checkbox
                      value={permission.code}
                      className="whitespace-normal"
                    >
                      <div>
                        <div className="font-medium">{permission.name}</div>
                        {permission.description && (
                          <div className="text-sm text-gray-500">
                            {permission.description}
                          </div>
                        )}
                        <div className="text-xs text-gray-400">
                          {permission.code}
                        </div>
                      </div>
                    </Checkbox>
                  </div>
                ))}
              </div>
            </Checkbox.Group>
          </div>
        </Form.Item>

        <Form.Item className="mb-0">
          <div className="flex justify-end space-x-2">
            <Button onClick={onCancel}>取消</Button>
            <Button type="primary" htmlType="submit" loading={loading}>
              {role ? "更新" : "创建"}
            </Button>
          </div>
        </Form.Item>
      </Form>
    </div>
  );
};
