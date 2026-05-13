import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Form, Input, InputNumber, Select, Space } from "antd";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import type { ICreateCatDto, IUpdateCatOwnerDto } from "@/services/dtos/cat";
import type { IUser } from "@/services/types/user";

const createCatSchema = z.object({
  name: z
    .string()
    .min(1, "请输入猫咪名称")
    .max(50, "名称不能超过50个字符"),
  breed: z
    .string()
    .min(1, "请输入品种")
    .max(50, "品种不能超过50个字符"),
  age: z.number().min(0, "年龄不能为负数").max(30, "年龄不能超过30"),
});

const updateOwnerSchema = z.object({
  ownerId: z.string().min(1, "请选择主人"),
});

type CreateCatFormData = z.infer<typeof createCatSchema>;
type UpdateOwnerFormData = z.infer<typeof updateOwnerSchema>;

interface ICreateCatFormProps {
  mode: "create";
  onSubmit: (data: ICreateCatDto) => void;
  onCancel: () => void;
  loading?: boolean;
}

interface IUpdateOwnerFormProps {
  mode: "updateOwner";
  users: IUser[];
  onSubmit: (data: IUpdateCatOwnerDto) => void;
  onCancel: () => void;
  loading?: boolean;
}

type ICatFormProps = ICreateCatFormProps | IUpdateOwnerFormProps;

export const CatForm: React.FC<ICatFormProps> = (props) => {
  const { mode, loading = false } = props;

  if (mode === "create") {
    return <CreateCatForm {...props} loading={loading} />;
  }

  return <UpdateOwnerForm {...props} loading={loading} />;
};

const CreateCatForm: React.FC<ICreateCatFormProps> = ({
  onSubmit,
  onCancel,
  loading,
}) => {
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateCatFormData>({
    resolver: zodResolver(createCatSchema),
    defaultValues: { name: "", breed: "", age: 0 },
  });

  return (
    <Form layout="vertical" onFinish={handleSubmit(onSubmit)}>
      <Form.Item
        label="猫咪名称"
        validateStatus={errors.name ? "error" : ""}
        help={errors.name?.message}
        required
      >
        <Controller
          name="name"
          control={control}
          render={({ field }) => (
            <Input {...field} placeholder="请输入猫咪名称" disabled={loading} />
          )}
        />
      </Form.Item>

      <Form.Item
        label="品种"
        validateStatus={errors.breed ? "error" : ""}
        help={errors.breed?.message}
        required
      >
        <Controller
          name="breed"
          control={control}
          render={({ field }) => (
            <Input {...field} placeholder="请输入品种" disabled={loading} />
          )}
        />
      </Form.Item>

      <Form.Item
        label="年龄"
        validateStatus={errors.age ? "error" : ""}
        help={errors.age?.message}
        required
      >
        <Controller
          name="age"
          control={control}
          render={({ field }) => (
            <InputNumber
              {...field}
              placeholder="请输入年龄"
              min={0}
              max={30}
              className="w-full"
              disabled={loading}
            />
          )}
        />
      </Form.Item>

      <Form.Item className="mt-6 mb-0">
        <Space className="w-full justify-end">
          <Button onClick={onCancel} disabled={loading}>
            取消
          </Button>
          <Button type="primary" htmlType="submit" loading={loading}>
            创建
          </Button>
        </Space>
      </Form.Item>
    </Form>
  );
};

const UpdateOwnerForm: React.FC<IUpdateOwnerFormProps> = ({
  users,
  onSubmit,
  onCancel,
  loading,
}) => {
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdateOwnerFormData>({
    resolver: zodResolver(updateOwnerSchema),
    defaultValues: { ownerId: "" },
  });

  return (
    <Form layout="vertical" onFinish={handleSubmit(onSubmit)}>
      <Form.Item
        label="选择新主人"
        validateStatus={errors.ownerId ? "error" : ""}
        help={errors.ownerId?.message}
        required
      >
        <Controller
          name="ownerId"
          control={control}
          render={({ field }) => (
            <Select
              {...field}
              placeholder="请选择新主人"
              disabled={loading}
              showSearch
              optionFilterProp="label"
              options={users.map((user) => ({
                value: user.id,
                label: `${user.displayName} (${user.username})`,
              }))}
            />
          )}
        />
      </Form.Item>

      <Form.Item className="mt-6 mb-0">
        <Space className="w-full justify-end">
          <Button onClick={onCancel} disabled={loading}>
            取消
          </Button>
          <Button type="primary" htmlType="submit" loading={loading}>
            更新主人
          </Button>
        </Space>
      </Form.Item>
    </Form>
  );
};
