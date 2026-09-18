import { DeleteOutlined, UploadOutlined } from "@ant-design/icons";
import { Button, List, message, Space, Typography, Upload } from "antd";
import type { UploadProps } from "antd";
import { useRef, useState } from "react";

import { DeleteAttachment, UploadAttachment } from "@/services/api/attachment";
import {
  ATTACHMENT_VISIBILITY,
  type AttachmentVisibility,
  type IAttachment,
  type IAttachmentSignedUrl,
} from "@/services/types/attachment";
import { AttachmentPreview } from "./attachment-preview";

const { Text } = Typography;

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;
const MAX_ATTACHMENT_COUNT = 5;

interface IAttachmentUploadProps {
  value?: IAttachment[];
  visibility?: AttachmentVisibility;
  maxCount?: number;
  maxSize?: number;
  accept?: string;
  disabled?: boolean;
  getSignedUrl?: (attachmentId: string) => Promise<IAttachmentSignedUrl>;
  onChange?: (attachments: IAttachment[]) => void;
}

const formatFileSize = (size: number) => {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
};

export const AttachmentUpload = ({
  value = [],
  visibility = ATTACHMENT_VISIBILITY.PRIVATE,
  maxCount = MAX_ATTACHMENT_COUNT,
  maxSize = MAX_ATTACHMENT_SIZE,
  accept,
  disabled,
  getSignedUrl,
  onChange,
}: IAttachmentUploadProps) => {
  const [pendingCount, setPendingCount] = useState(0);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const valueRef = useRef(value);
  const pendingCountRef = useRef(0);
  valueRef.current = value;

  const handleUpload: UploadProps["customRequest"] = async ({
    file,
    onSuccess,
    onError,
  }) => {
    const uploadFile = file as File;

    if (valueRef.current.length + pendingCountRef.current >= maxCount) {
      message.error(`最多上传 ${maxCount} 个附件`);
      onError?.(new Error("Attachment count limit exceeded"));
      return;
    }

    if (uploadFile.size > maxSize) {
      message.error(`文件大小不能超过 ${formatFileSize(maxSize)}`);
      onError?.(new Error("File is too large"));
      return;
    }

    pendingCountRef.current += 1;
    setPendingCount((current) => current + 1);

    try {
      const attachments = await UploadAttachment({
        files: [uploadFile],
        visibility,
      });
      const nextValue = [...valueRef.current, ...attachments];

      valueRef.current = nextValue;
      onChange?.(nextValue);
      onSuccess?.(attachments[0]);
    } catch (error) {
      onError?.(error as Error);
    } finally {
      pendingCountRef.current -= 1;
      setPendingCount((current) => current - 1);
    }
  };

  const handleDelete = async (attachment: IAttachment) => {
    setDeletingIds((current) => new Set(current).add(attachment.id));

    try {
      if (!attachment.bizType) {
        await DeleteAttachment(attachment.id);
      }

      const nextValue = valueRef.current.filter(
        (item) => item.id !== attachment.id,
      );

      valueRef.current = nextValue;
      onChange?.(nextValue);
    } catch (error) {
      message.error(
        error instanceof Error ? error.message : "附件删除失败，请稍后重试",
      );
    } finally {
      setDeletingIds((current) => {
        const next = new Set(current);
        next.delete(attachment.id);
        return next;
      });
    }
  };

  return (
    <Space direction="vertical" className="w-full" size="small">
      <Upload
        accept={accept}
        multiple
        customRequest={handleUpload}
        showUploadList={false}
        disabled={disabled || value.length >= maxCount}
      >
        <Button
          icon={<UploadOutlined />}
          disabled={disabled || value.length >= maxCount}
          loading={pendingCount > 0}
        >
          上传附件
        </Button>
      </Upload>

      {value.length > 0 && (
        <List
          size="small"
          bordered
          dataSource={value}
          renderItem={(attachment) => (
            <List.Item
              actions={[
                <Button
                  key="delete"
                  type="text"
                  danger
                  aria-label={`删除 ${attachment.originalName}`}
                  icon={<DeleteOutlined />}
                  disabled={disabled}
                  loading={deletingIds.has(attachment.id)}
                  onClick={() => void handleDelete(attachment)}
                />,
              ]}
            >
              <List.Item.Meta
                avatar={
                  <AttachmentPreview
                    attachment={attachment}
                    getSignedUrl={getSignedUrl}
                  />
                }
                title={attachment.originalName}
                description={
                  <Text type="secondary">
                    {formatFileSize(attachment.size)} ·{" "}
                    {attachment.visibility === ATTACHMENT_VISIBILITY.PUBLIC
                      ? "公开"
                      : "私有"}
                  </Text>
                }
              />
            </List.Item>
          )}
        />
      )}
    </Space>
  );
};
