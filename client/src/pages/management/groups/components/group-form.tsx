import type {
  ICreateGroupDto,
  ICreateRootOrgGroupDto,
  IUpdateGroupDto,
} from "@/services/dtos/group";
import type { IGroup } from "@/services/types/group";
import { Button, Form, Input, Select, Switch } from "antd";
import { useEffect } from "react";

const { TextArea } = Input;
const { Option } = Select;

interface IGroupFormProps {
  group?: IGroup | null;
  groups: IGroup[];
  onSubmit: (
    data: ICreateGroupDto | ICreateRootOrgGroupDto | IUpdateGroupDto,
  ) => void;
  onCancel: () => void;
  loading?: boolean;
}

export const GroupForm = ({
  group,
  groups,
  onSubmit,
  onCancel,
  loading = false,
}: IGroupFormProps) => {
  const [form] = Form.useForm();

  useEffect(() => {
    if (group) {
      form.setFieldsValue({
        name: group.name,
        description: group.description,
        parentId: group.parent?.id,
        isOrganization: group.isOrganization,
        addSelfToGroup: false,
      });
    } else {
      form.resetFields();
    }
  }, [group, form]);

  const handleSubmit = (values: any) => {
    if (group) {
      // 编辑模式
      const data: IUpdateGroupDto = {
        name: values.name,
        description: values.description,
        parentId: values.parentId,
      };
      onSubmit(data);
    } else {
      // 创建模式
      const isOrganization = values.isOrganization || false;
      const hasParent = !!values.parentId;

      if (isOrganization && !hasParent) {
        // 创建根组织群组
        const data: ICreateRootOrgGroupDto = {
          name: values.name,
          description: values.description,
          addSelfToGroup: values.addSelfToGroup || false,
        };
        onSubmit(data);
      } else {
        // 创建普通群组
        const data: ICreateGroupDto = {
          name: values.name,
          description: values.description,
          parentId: values.parentId,
          isOrganization: isOrganization,
          addSelfToGroup: values.addSelfToGroup || false,
        };
        onSubmit(data);
      }
    }
  };

  // 过滤出可以作为父群组的选项（排除自己和子群组）
  const getAvailableParentGroups = () => {
    if (!group) return groups;

    const excludeIds = new Set<string>();

    // 添加当前群组ID
    excludeIds.add(group.id);

    // 递归添加所有子群组ID
    const addChildrenIds = (children: IGroup[]) => {
      children.forEach((child) => {
        excludeIds.add(child.id);
        if (child.children) {
          addChildrenIds(child.children);
        }
      });
    };

    if (group.children) {
      addChildrenIds(group.children);
    }

    return groups.filter((g) => !excludeIds.has(g.id));
  };

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleSubmit}
      className="mt-4"
    >
      <Form.Item
        label="群组名称"
        name="name"
        rules={[
          { required: true, message: "请输入群组名称" },
          { min: 2, message: "群组名称至少2个字符" },
          { max: 50, message: "群组名称最多50个字符" },
        ]}
      >
        <Input placeholder="输入群组名称" />
      </Form.Item>

      <Form.Item
        noStyle
        shouldUpdate={(prev, curr) =>
          prev.isOrganization !== curr.isOrganization
        }
      >
        {({ getFieldValue }) => (
          <Form.Item
            label="父群组"
            name="parentId"
            help={
              getFieldValue("isOrganization")
                ? "组织群组可以不选择父群组，将创建为根组织群组"
                : "请为群组选择一个父群组"
            }
            rules={[
              {
                validator: (_, value) => {
                  // 如果是编辑模式，且是根组织群组，则不需要父群组
                  if (group?.isOrganization && !group.parent) {
                    return Promise.resolve();
                  }
                  // 如果是创建模式，检查是否为根组织群组
                  const isOrganization = getFieldValue("isOrganization");
                  if (isOrganization && !value) {
                    return Promise.resolve(); // 根组织群组不需要父群组
                  }
                  // 其他情况需要父群组
                  if (!value) {
                    return Promise.reject(new Error("请选择父群组"));
                  }
                  return Promise.resolve();
                },
              },
            ]}
          >
            <Select
              placeholder={
                getFieldValue("isOrganization")
                  ? "选择父群组（根组织群组可不选）"
                  : "选择父群组"
              }
              allowClear
              showSearch
              filterOption={(input, option) => {
                const label = option?.label || option?.children;
                return (
                  String(label)?.toLowerCase().indexOf(input.toLowerCase()) >= 0
                );
              }}
            >
              {getAvailableParentGroups().map((g) => (
                <Option key={g.id} value={g.id}>
                  {g.name}
                  {g.isOrganization && " (组织)"}
                </Option>
              ))}
            </Select>
          </Form.Item>
        )}
      </Form.Item>

      <Form.Item
        label="描述"
        name="description"
        rules={[{ max: 200, message: "描述最多200个字符" }]}
      >
        <TextArea
          placeholder="输入群组描述（可选）"
          rows={3}
          maxLength={200}
          showCount
        />
      </Form.Item>

      {!group && (
        <>
          <Form.Item
            label="组织群组"
            name="isOrganization"
            valuePropName="checked"
          >
            <Switch
              checkedChildren="是"
              unCheckedChildren="否"
              onChange={(checked) => {
                if (checked) {
                  form.setFieldValue("parentId", undefined);
                }
              }}
            />
          </Form.Item>

          <Form.Item
            label="自动加入群组"
            name="addSelfToGroup"
            valuePropName="checked"
          >
            <Switch checkedChildren="是" unCheckedChildren="否" />
          </Form.Item>
        </>
      )}

      <div className="mt-6 flex justify-end space-x-2">
        <Button onClick={onCancel}>取消</Button>
        <Button type="primary" htmlType="submit" loading={loading}>
          {group ? "更新" : "创建"}
        </Button>
      </div>
    </Form>
  );
};
