import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
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
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useState } from "react";

import { DataTable } from "@/components/data-table";
import {
  CreateDocument,
  DeleteDocument,
  GetDocument,
  GetDocuments,
  UpdateDocument,
} from "@/services/api/document";
import type {
  ICreateDocumentDto,
  IUpdateDocumentDto,
} from "@/services/dtos/document";
import {
  DOCUMENT_STATUS,
  type IDocument,
  type IDocumentListItem,
} from "@/services/types/document";
import { DocumentDetail } from "./components/document-detail";
import { DocumentForm } from "./components/document-form";

const { Title } = Typography;
const { Search } = Input;

export const Documents = () => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [keyword, setKeyword] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDocument, setEditingDocument] = useState<IDocument>();
  const [viewingDocumentId, setViewingDocumentId] = useState<string>();
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const queryClient = useQueryClient();

  const {
    data: documentsPage,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["documents", { page, pageSize, keyword }],
    queryFn: () =>
      GetDocuments({
        page,
        pageSize,
        keyword: keyword || undefined,
      }),
    placeholderData: (previous) => previous,
  });

  const { data: viewingDocument, isLoading: detailLoading } = useQuery({
    queryKey: ["documents", viewingDocumentId],
    queryFn: () => GetDocument(viewingDocumentId as string),
    enabled: Boolean(viewingDocumentId),
  });

  const createMutation = useMutation({
    mutationFn: CreateDocument,
    onSuccess: () => {
      message.success("文档创建成功");
      setIsFormOpen(false);
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (error: Error) => {
      message.error(error.message || "创建失败");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: IUpdateDocumentDto }) =>
      UpdateDocument(id, data),
    onSuccess: () => {
      message.success("文档更新成功");
      setIsFormOpen(false);
      setEditingDocument(undefined);
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (error: Error) => {
      message.error(error.message || "更新失败");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: DeleteDocument,
    onSuccess: () => {
      message.success("文档删除成功");
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (error: Error) => {
      message.error(error.message || "删除失败");
    },
  });

  const handleEdit = async (id: string) => {
    try {
      const document = await GetDocument(id);
      setEditingDocument(document);
      setIsFormOpen(true);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载文档失败");
    }
  };

  const columns: ColumnsType<IDocumentListItem> = [
    {
      title: "标题",
      dataIndex: "title",
      key: "title",
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      render: (status: IDocumentListItem["status"]) => (
        <Tag color={status === DOCUMENT_STATUS.PUBLISHED ? "green" : "default"}>
          {status === DOCUMENT_STATUS.PUBLISHED ? "已发布" : "草稿"}
        </Tag>
      ),
    },
    {
      title: "所有者",
      dataIndex: "owner",
      key: "owner",
      render: (owner: IDocumentListItem["owner"]) => owner.displayName,
    },
    {
      title: "附件数量",
      dataIndex: "attachmentCount",
      key: "attachmentCount",
    },
    {
      title: "更新时间",
      dataIndex: "updatedAt",
      key: "updatedAt",
      render: (updatedAt: string) => new Date(updatedAt).toLocaleString(),
    },
    {
      title: "操作",
      key: "actions",
      width: 180,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="查看详情">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => {
                setViewingDocumentId(record.id);
                setIsDetailOpen(true);
              }}
            />
          </Tooltip>
          <Tooltip title="编辑">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => void handleEdit(record.id)}
            />
          </Tooltip>
          <Popconfirm
            title="确认删除资料文档"
            description="文档及其附件会进入软删除状态，确定继续吗？"
            okText="确认"
            cancelText="取消"
            onConfirm={() => deleteMutation.mutate(record.id)}
          >
            <Tooltip title="删除">
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                loading={deleteMutation.isPending}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col p-6">
      <Card
        className="flex min-h-0 flex-1 flex-col"
        classNames={{ body: "flex min-h-0 flex-1 flex-col" }}
      >
        <div className="mb-6 shrink-0">
          <div className="mb-4 flex items-center justify-between">
            <Title level={2} className="!mb-0">
              资料文档
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
                onClick={() => {
                  setEditingDocument(undefined);
                  setIsFormOpen(true);
                }}
              >
                新建文档
              </Button>
            </Space>
          </div>

          <div className="flex items-center justify-between">
            <Search
              placeholder="搜索文档标题"
              allowClear
              enterButton={<SearchOutlined />}
              value={keyword}
              onChange={(event) => {
                setKeyword(event.target.value);
                setPage(1);
              }}
              style={{ width: 400 }}
            />
            <div className="text-gray-500">
              共 {documentsPage?.total ?? 0} 篇文档
            </div>
          </div>
        </div>

        <DataTable
          columns={columns}
          dataSource={documentsPage?.list ?? []}
          rowKey="id"
          loading={isLoading}
          page={page}
          pageSize={pageSize}
          total={documentsPage?.total ?? 0}
          scrollX={1000}
          onPaginationChange={(nextPage, nextPageSize) => {
            setPage(nextPage);
            setPageSize(nextPageSize);
          }}
        />
      </Card>

      <Modal
        title={editingDocument ? "编辑文档" : "新建文档"}
        open={isFormOpen}
        onCancel={() => {
          setIsFormOpen(false);
          setEditingDocument(undefined);
        }}
        footer={null}
        width={720}
        destroyOnHidden
      >
        <DocumentForm
          mode={editingDocument ? "edit" : "create"}
          document={editingDocument}
          onSubmit={(data) => {
            if (editingDocument) {
              updateMutation.mutate({
                id: editingDocument.id,
                data: data as IUpdateDocumentDto,
              });
              return;
            }

            createMutation.mutate(data as ICreateDocumentDto);
          }}
          onCancel={() => {
            setIsFormOpen(false);
            setEditingDocument(undefined);
          }}
          loading={createMutation.isPending || updateMutation.isPending}
        />
      </Modal>

      <DocumentDetail
        document={viewingDocument}
        open={isDetailOpen}
        loading={detailLoading}
        onClose={() => {
          setIsDetailOpen(false);
          setViewingDocumentId(undefined);
        }}
      />
    </div>
  );
};
