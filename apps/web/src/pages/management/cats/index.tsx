import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Card,
  Input,
  message,
  Modal,
  Popconfirm,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useState } from "react";

import {
  CreateCat,
  DeleteCat,
  GetCats,
  UpdateCatOwner,
} from "@/services/api/cat";
import { GetUsers } from "@/services/api/user";
import type { IUpdateCatOwnerDto } from "@/services/dtos/cat";
import type { ICat } from "@/services/types/cat";

import { CatForm } from "./components/cat-form";

const { Title } = Typography;
const { Search } = Input;

export const Cats = () => {
  const [searchText, setSearchText] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "updateOwner">("create");
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);

  const queryClient = useQueryClient();

  const {
    data: cats = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["cats"],
    queryFn: GetCats,
  });

  const { data: usersPage } = useQuery({
    queryKey: ["users", "selector"],
    // 此处仅用于「主人选择器」的下拉数据，传较大 pageSize 一次性拉取；
    // 后续若用户数量增长应改成异步搜索 + 远端筛选。
    queryFn: () => GetUsers({ pageSize: 1000 }),
  });
  const users = usersPage?.list ?? [];

  const createCatMutation = useMutation({
    mutationFn: CreateCat,
    onSuccess: () => {
      message.success("猫咪创建成功");
      setIsFormOpen(false);
      queryClient.invalidateQueries({ queryKey: ["cats"] });
    },
    onError: (error: Error) => {
      message.error(error.message || "创建失败");
    },
  });

  const updateOwnerMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: IUpdateCatOwnerDto }) =>
      UpdateCatOwner(id, data),
    onSuccess: () => {
      message.success("主人更新成功");
      setIsFormOpen(false);
      setSelectedCatId(null);
      queryClient.invalidateQueries({ queryKey: ["cats"] });
    },
    onError: (error: Error) => {
      message.error(error.message || "更新失败");
    },
  });

  const deleteCatMutation = useMutation({
    mutationFn: DeleteCat,
    onSuccess: () => {
      message.success("删除成功");
      queryClient.invalidateQueries({ queryKey: ["cats"] });
    },
    onError: (error: Error) => {
      message.error(error.message || "删除失败");
    },
  });

  const filteredCats = cats.filter(
    (cat) =>
      cat.name.toLowerCase().includes(searchText.toLowerCase()) ||
      cat.breed.toLowerCase().includes(searchText.toLowerCase()),
  );

  const handleCreate = () => {
    setFormMode("create");
    setSelectedCatId(null);
    setIsFormOpen(true);
  };

  const handleUpdateOwner = (catId: string) => {
    setFormMode("updateOwner");
    setSelectedCatId(catId);
    setIsFormOpen(true);
  };

  const columns: ColumnsType<ICat> = [
    {
      title: "名称",
      dataIndex: "name",
      key: "name",
      sorter: (a, b) => a.name.localeCompare(b.name),
    },
    {
      title: "品种",
      dataIndex: "breed",
      key: "breed",
    },
    {
      title: "年龄",
      dataIndex: "age",
      key: "age",
      sorter: (a, b) => a.age - b.age,
    },
    {
      title: "主人",
      dataIndex: "owner",
      key: "owner",
      render: (owner: ICat["owner"]) =>
        owner ? (
          <Tag color="blue">{owner.displayName}</Tag>
        ) : (
          <Tag>无主人</Tag>
        ),
    },
    {
      title: "操作",
      key: "actions",
      width: 150,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="更换主人">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => handleUpdateOwner(record.id)}
            />
          </Tooltip>
          <Popconfirm
            title="确认删除"
            description="确定要删除这只猫咪吗？"
            onConfirm={() => deleteCatMutation.mutate(record.id)}
            okText="确认"
            cancelText="取消"
          >
            <Tooltip title="删除">
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                loading={deleteCatMutation.isPending}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (error) {
    return (
      <Card>
        <div className="text-center text-red-500">
          加载数据时出错：{(error as any)?.message}
        </div>
      </Card>
    );
  }

  return (
    <div className="p-6">
      <Card>
        <div className="mb-6">
          <div className="mb-4 flex items-center justify-between">
            <Title level={2} className="!mb-0">
              猫咪管理
            </Title>
            <Space>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => refetch()}
                loading={isLoading}
              >
                刷新
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleCreate}
              >
                添加猫咪
              </Button>
            </Space>
          </div>

          <div className="flex items-center justify-between">
            <Search
              placeholder="搜索名称或品种"
              allowClear
              enterButton={<SearchOutlined />}
              size="large"
              style={{ width: 400 }}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
            <div className="text-gray-500">
              共 {filteredCats.length} 只猫咪
            </div>
          </div>
        </div>

        <Table
          columns={columns}
          dataSource={filteredCats}
          rowKey="id"
          loading={isLoading}
          pagination={{
            total: filteredCats.length,
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
          }}
        />
      </Card>

      <Modal
        title={formMode === "create" ? "添加猫咪" : "更换主人"}
        open={isFormOpen}
        onCancel={() => {
          setIsFormOpen(false);
          setSelectedCatId(null);
        }}
        footer={null}
        width={500}
        destroyOnHidden
      >
        {formMode === "create" ? (
          <CatForm
            mode="create"
            onSubmit={(data) => createCatMutation.mutate(data)}
            onCancel={() => {
              setIsFormOpen(false);
              setSelectedCatId(null);
            }}
            loading={createCatMutation.isPending}
          />
        ) : (
          <CatForm
            mode="updateOwner"
            users={users}
            onSubmit={(data) => {
              if (selectedCatId) {
                updateOwnerMutation.mutate({ id: selectedCatId, data });
              }
            }}
            onCancel={() => {
              setIsFormOpen(false);
              setSelectedCatId(null);
            }}
            loading={updateOwnerMutation.isPending}
          />
        )}
      </Modal>
    </div>
  );
};
