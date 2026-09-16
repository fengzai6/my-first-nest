import { FileOutlined } from "@ant-design/icons";
import { Image, List, Spin, Typography } from "antd";
import { useEffect, useState } from "react";

import { GetDocumentAttachmentSignedUrl } from "@/services/api/document";
import {
  ATTACHMENT_VISIBILITY,
  type IAttachment,
} from "@/services/types/attachment";

const { Text } = Typography;

interface IDocumentAttachmentsProps {
  documentId: string;
  attachments: IAttachment[];
}

const formatFileSize = (size: number) => {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
};

const isImage = (mimeType: string) => mimeType.startsWith("image/");

const DocumentAttachmentPreview = ({
  documentId,
  attachment,
}: {
  documentId: string;
  attachment: IAttachment;
}) => {
  const [previewUrl, setPreviewUrl] = useState(attachment.url);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (
      !isImage(attachment.mimeType) ||
      attachment.visibility === ATTACHMENT_VISIBILITY.PUBLIC
    ) {
      setPreviewUrl(attachment.url);
      return;
    }

    let cancelled = false;
    setLoading(true);

    GetDocumentAttachmentSignedUrl(documentId, attachment.id)
      .then(({ url }) => {
        if (!cancelled) setPreviewUrl(url);
      })
      .catch(() => {
        if (!cancelled) setPreviewUrl("");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    attachment.id,
    attachment.mimeType,
    attachment.url,
    attachment.visibility,
    documentId,
  ]);

  if (!isImage(attachment.mimeType)) {
    return <FileOutlined />;
  }

  if (loading) {
    return <Spin size="small" />;
  }

  if (!previewUrl) {
    return <FileOutlined />;
  }

  return (
    <Image
      src={previewUrl}
      alt={attachment.originalName}
      width={48}
      height={48}
      className="rounded object-cover"
      preview={{ mask: "预览" }}
    />
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
        <List.Item>
          <List.Item.Meta
            avatar={
              <DocumentAttachmentPreview
                documentId={documentId}
                attachment={attachment}
              />
            }
            title={attachment.originalName}
            description={
              <Text type="secondary">{formatFileSize(attachment.size)}</Text>
            }
          />
        </List.Item>
      )}
    />
  );
};
