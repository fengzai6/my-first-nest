import { Descriptions, Drawer, Tag, Typography } from "antd";
import { useQuery } from "@tanstack/react-query";

import { GetManagementAttachment } from "@/services/api/attachment-management";
import { ATTACHMENT_VISIBILITY } from "@/services/types/attachment";
import type { IManagementAttachment } from "@/services/types/attachment-management";

const { Text } = Typography;

interface IAttachmentDetailDrawerProps {
  attachmentId?: string;
  fallback?: IManagementAttachment;
  open: boolean;
  onClose: () => void;
}

const ATTACHMENT_STATUS_LABEL = {
  bound: "已绑定",
  orphan: "孤儿附件",
  deleted: "已删除",
} as const;

const CLEANUP_STATUS_LABEL = {
  not_candidate: "不参与清理",
  waiting: "等待保留期",
  eligible: "可清理",
} as const;

const formatFileSize = (size: number) => {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  return new Date(value).toLocaleString("zh-CN");
};

export const AttachmentDetailDrawer = ({
  attachmentId,
  fallback,
  open,
  onClose,
}: IAttachmentDetailDrawerProps) => {
  const detailQuery = useQuery({
    queryKey: ["attachments-management", "detail", attachmentId],
    queryFn: () => GetManagementAttachment(attachmentId!),
    enabled: open && Boolean(attachmentId),
  });
  const attachment = detailQuery.data ?? fallback;

  return (
    <Drawer title="附件详情" open={open} onClose={onClose} width={560}>
      {attachment && (
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label="文件名">
            {attachment.originalName}
          </Descriptions.Item>
          <Descriptions.Item label="MIME">
            {attachment.mimeType}
          </Descriptions.Item>
          <Descriptions.Item label="大小">
            {formatFileSize(attachment.size)}
          </Descriptions.Item>
          <Descriptions.Item label="可见性">
            {attachment.visibility === ATTACHMENT_VISIBILITY.PUBLIC
              ? "公开"
              : "私有"}
          </Descriptions.Item>
          <Descriptions.Item label="上传人">
            {attachment.uploadedBy.displayName}
          </Descriptions.Item>
          <Descriptions.Item label="业务类型">
            {attachment.bizType ?? "-"}
          </Descriptions.Item>
          <Descriptions.Item label="业务 ID">
            {attachment.bizId ?? "-"}
          </Descriptions.Item>
          <Descriptions.Item label="附件状态">
            <Tag>{ATTACHMENT_STATUS_LABEL[attachment.status]}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="清理状态">
            <Tag>{CLEANUP_STATUS_LABEL[attachment.cleanupStatus]}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="创建时间">
            {formatDateTime(attachment.createdAt)}
          </Descriptions.Item>
          <Descriptions.Item label="更新时间">
            {formatDateTime(attachment.updatedAt)}
          </Descriptions.Item>
          <Descriptions.Item label="删除时间">
            {formatDateTime(attachment.deletedAt)}
          </Descriptions.Item>
          <Descriptions.Item label="保留期截止时间">
            {formatDateTime(attachment.retentionDeadline)}
          </Descriptions.Item>
        </Descriptions>
      )}

      {detailQuery.isError && (
        <Text type="danger">{detailQuery.error.message}</Text>
      )}
    </Drawer>
  );
};
