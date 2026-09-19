import { Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { DataTable } from "@/components/data-table";
import { useUserPermissionContext } from "@/components/root/user-permission-context";
import { GetManagementAttachments } from "@/services/api/attachment-management";
import type { IFindManagementAttachmentsQuery } from "@/services/dtos/attachment-management";
import { ATTACHMENT_VISIBILITY } from "@/services/types/attachment";
import type {
  AttachmentCleanupStatus,
  AttachmentManagementStatus,
  IManagementAttachment,
} from "@/services/types/attachment-management";
import { ATTACHMENT_MANAGEMENT_PERMISSIONS } from "@/services/types/user";
import { AttachmentActions } from "./components/attachment-actions";
import { AttachmentBulkActions } from "./components/attachment-bulk-actions";
import { AttachmentCleanupCard } from "./components/attachment-cleanup-card";
import { AttachmentDetailDrawer } from "./components/attachment-detail-drawer";
import { AttachmentFilters } from "./components/attachment-filters";

const { Title } = Typography;

const STATUS_LABEL: Record<AttachmentManagementStatus, string> = {
  bound: "已绑定",
  orphan: "孤儿附件",
  deleted: "已删除",
};

const CLEANUP_STATUS_LABEL: Record<AttachmentCleanupStatus, string> = {
  not_candidate: "不参与清理",
  waiting: "等待保留期",
  eligible: "可清理",
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  return new Date(value).toLocaleString("zh-CN");
};

export const AttachmentsManagement = () => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [filters, setFilters] = useState<IFindManagementAttachmentsQuery>({});
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [viewingAttachment, setViewingAttachment] =
    useState<IManagementAttachment>();
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isBulkLoading, setIsBulkLoading] = useState(false);
  const queryClient = useQueryClient();
  const { permissions } = useUserPermissionContext();
  const canManage = permissions.includes(
    ATTACHMENT_MANAGEMENT_PERMISSIONS.MANAGE,
  );

  const attachmentsQuery = useQuery({
    queryKey: ["attachments-management", { page, pageSize, ...filters }],
    queryFn: () =>
      GetManagementAttachments({
        page,
        pageSize,
        ...filters,
      }),
    placeholderData: (previous) => previous,
  });

  const attachments = attachmentsQuery.data?.list ?? [];

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["attachments-management"] });
  };

  const handleFiltersChange = (
    nextFilters: IFindManagementAttachmentsQuery,
  ) => {
    setFilters(nextFilters);
    setPage(1);
    setSelectedRowKeys([]);
  };

  const handleView = (attachment: IManagementAttachment) => {
    setViewingAttachment(attachment);
    setIsDetailOpen(true);
  };

  const columns: ColumnsType<IManagementAttachment> = [
    {
      title: "文件名",
      dataIndex: "originalName",
      key: "originalName",
      width: 240,
      ellipsis: true,
    },
    {
      title: "类型",
      dataIndex: "mimeType",
      key: "mimeType",
      width: 180,
      ellipsis: true,
    },
    {
      title: "可见性",
      dataIndex: "visibility",
      key: "visibility",
      width: 100,
      render: (visibility: IManagementAttachment["visibility"]) =>
        visibility === ATTACHMENT_VISIBILITY.PUBLIC ? "公开" : "私有",
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 110,
      render: (status: AttachmentManagementStatus) => (
        <Tag>{STATUS_LABEL[status]}</Tag>
      ),
    },
    {
      title: "清理状态",
      dataIndex: "cleanupStatus",
      key: "cleanupStatus",
      width: 120,
      render: (status: AttachmentCleanupStatus) => (
        <Tag>{CLEANUP_STATUS_LABEL[status]}</Tag>
      ),
    },
    {
      title: "业务类型",
      dataIndex: "bizType",
      key: "bizType",
      width: 120,
      render: (value: string | null) => value ?? "-",
    },
    {
      title: "上传人",
      dataIndex: "uploadedBy",
      key: "uploadedBy",
      width: 140,
      render: (uploadedBy: IManagementAttachment["uploadedBy"]) =>
        uploadedBy.displayName,
    },
    {
      title: "创建时间",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 180,
      render: formatDateTime,
    },
    {
      title: "操作",
      key: "actions",
      width: 280,
      fixed: "right",
      render: (_, attachment) => (
        <AttachmentActions
          attachment={attachment}
          canManage={canManage}
          onView={handleView}
          onRefresh={refresh}
        />
      ),
    },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <Title level={2} className="!mb-0">
          附件管理
        </Title>
      </div>

      <AttachmentCleanupCard canManage={canManage} />

      <div className="flex min-h-0 flex-1 flex-col gap-3 rounded-lg border border-slate-200 p-4">
        <div className="flex items-center justify-between gap-4">
          <AttachmentFilters
            filters={filters}
            loading={attachmentsQuery.isFetching}
            onChange={handleFiltersChange}
            onRefresh={() => void attachmentsQuery.refetch()}
          />
          <AttachmentBulkActions
            selectedIds={selectedRowKeys.map(String)}
            canManage={canManage}
            loading={isBulkLoading}
            onChangeLoading={setIsBulkLoading}
            onFinished={() => {
              setSelectedRowKeys([]);
              refresh();
            }}
          />
        </div>

        <DataTable
          columns={columns}
          dataSource={attachments}
          rowKey="id"
          loading={attachmentsQuery.isLoading}
          page={page}
          pageSize={pageSize}
          total={attachmentsQuery.data?.total ?? 0}
          scrollX={1500}
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
            getCheckboxProps: (record) => ({
              disabled: record.status !== "orphan",
            }),
          }}
          onPaginationChange={(nextPage, nextPageSize) => {
            setPage(nextPage);
            setPageSize(nextPageSize);
            setSelectedRowKeys([]);
          }}
        />
      </div>

      <AttachmentDetailDrawer
        attachmentId={viewingAttachment?.id}
        fallback={viewingAttachment}
        open={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setViewingAttachment(undefined);
        }}
      />
    </div>
  );
};
