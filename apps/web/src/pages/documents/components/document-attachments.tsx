import {
  CopyOutlined,
  DownloadOutlined,
  LinkOutlined,
} from "@ant-design/icons";
import { Button, List, message, Space, Tooltip, Typography } from "antd";
import { useRef, useState } from "react";

import { AttachmentPreview } from "@/components/attachment-upload/attachment-preview";
import {
  createAttachmentDownloadUrl,
  resolveAttachmentUrl,
} from "@/components/attachment-upload/attachment-link";
import { downloadAttachment } from "./attachment-download";
import { GetDocumentAttachmentSignedUrl } from "@/services/api/document";
import {
  ATTACHMENT_VISIBILITY,
  type IAttachment,
  type IAttachmentSignedUrl,
} from "@/services/types/attachment";

const { Text } = Typography;

interface IDocumentAttachmentsProps {
  documentId: string;
  attachments: IAttachment[];
}

type AttachmentAction = "copy" | "open" | "download";

const formatFileSize = (size: number) => {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
};

const DocumentAttachmentItem = ({
  documentId,
  attachment,
}: {
  documentId: string;
  attachment: IAttachment;
}) => {
  const [loadingAction, setLoadingAction] = useState<AttachmentAction | null>(
    null,
  );
  const signedUrlPromiseRef = useRef<Promise<IAttachmentSignedUrl> | null>(
    null,
  );

  const getSignedUrl = () => {
    if (attachment.visibility === ATTACHMENT_VISIBILITY.PUBLIC) {
      return Promise.resolve({
        url: attachment.url,
        expiresAt: 0,
      });
    }

    signedUrlPromiseRef.current ??= GetDocumentAttachmentSignedUrl(
      documentId,
      attachment.id,
    ).catch((error) => {
      signedUrlPromiseRef.current = null;
      throw error;
    });

    return signedUrlPromiseRef.current;
  };

  const runAction = async (action: AttachmentAction) => {
    if (loadingAction) return;

    setLoadingAction(action);

    try {
      const { url } = await getSignedUrl();
      const absoluteUrl = resolveAttachmentUrl(url, window.location.origin);

      if (action === "copy") {
        await navigator.clipboard.writeText(absoluteUrl);
        message.success("附件链接已复制");
        return;
      }

      if (action === "open") {
        const openedWindow = window.open(absoluteUrl, "_blank");
        if (!openedWindow) {
          throw new Error("浏览器阻止了新窗口");
        }
        openedWindow.opener = null;
        return;
      }

      const downloadUrl = createAttachmentDownloadUrl(
        absoluteUrl,
        window.location.origin,
      );
      await downloadAttachment(downloadUrl, attachment.originalName);
    } catch (error) {
      const actionName =
        action === "copy" ? "复制链接" : action === "open" ? "打开" : "下载";
      message.error(
        error instanceof Error
          ? `${actionName}失败：${error.message}`
          : `${actionName}失败，请稍后重试`,
      );
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <List.Item
      actions={[
        <Space key="actions" size="small">
          <Tooltip title="复制链接">
            <Button
              type="text"
              aria-label={`复制 ${attachment.originalName} 的链接`}
              icon={<CopyOutlined />}
              loading={loadingAction === "copy"}
              disabled={loadingAction !== null}
              onClick={() => void runAction("copy")}
            />
          </Tooltip>
          <Tooltip title="打开">
            <Button
              type="text"
              aria-label={`打开 ${attachment.originalName}`}
              icon={<LinkOutlined />}
              loading={loadingAction === "open"}
              disabled={loadingAction !== null}
              onClick={() => void runAction("open")}
            />
          </Tooltip>
          <Tooltip title="下载">
            <Button
              type="text"
              aria-label={`下载 ${attachment.originalName}`}
              icon={<DownloadOutlined />}
              loading={loadingAction === "download"}
              disabled={loadingAction !== null}
              onClick={() => void runAction("download")}
            />
          </Tooltip>
        </Space>,
      ]}
    >
      <List.Item.Meta
        avatar={
          <AttachmentPreview
            attachment={attachment}
            getSignedUrl={() => getSignedUrl()}
          />
        }
        title={attachment.originalName}
        description={
          <Text type="secondary">{formatFileSize(attachment.size)}</Text>
        }
      />
    </List.Item>
  );
};

export const DocumentAttachments = ({
  documentId,
  attachments,
}: IDocumentAttachmentsProps) => {
  if (attachments.length === 0) {
    return <Text type="secondary">暂无附件</Text>;
  }

  return (
    <List
      size="small"
      bordered
      dataSource={attachments}
      renderItem={(attachment) => (
        <DocumentAttachmentItem
          key={attachment.id}
          documentId={documentId}
          attachment={attachment}
        />
      )}
    />
  );
};
