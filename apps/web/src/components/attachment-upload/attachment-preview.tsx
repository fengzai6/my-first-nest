import { FileOutlined } from "@ant-design/icons";
import { Image, Spin } from "antd";
import { useEffect, useEffectEvent, useState } from "react";

import { GetAttachmentSignedUrl } from "@/services/api/attachment";
import {
  ATTACHMENT_VISIBILITY,
  type IAttachment,
  type IAttachmentSignedUrl,
} from "@/services/types/attachment";

interface IAttachmentPreviewProps {
  attachment: IAttachment;
  getSignedUrl?: (attachment: IAttachment) => Promise<IAttachmentSignedUrl>;
}

const isImage = (mimeType: string) => mimeType.startsWith("image/");

const defaultGetSignedUrl = (attachment: IAttachment) =>
  GetAttachmentSignedUrl(attachment.id);

export const AttachmentPreview = ({
  attachment,
  getSignedUrl,
}: IAttachmentPreviewProps) => {
  const [previewUrl, setPreviewUrl] = useState(attachment.url);
  const [loading, setLoading] = useState(false);

  const requestSignedUrl = useEffectEvent((attachment: IAttachment) => {
    const request = getSignedUrl ?? defaultGetSignedUrl;

    return request(attachment);
  });

  useEffect(() => {
    if (
      !isImage(attachment.mimeType) ||
      attachment.visibility === ATTACHMENT_VISIBILITY.PUBLIC
    ) {
      setPreviewUrl(attachment.url);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    requestSignedUrl(attachment)
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
    attachment.bizType,
    attachment.bizId,
    getSignedUrl,
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
