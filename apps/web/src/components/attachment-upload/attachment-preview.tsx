import { FileOutlined } from "@ant-design/icons";
import { Image, Spin } from "antd";
import { useEffect, useState } from "react";

import { GetAttachmentSignedUrl } from "@/services/api/attachment";
import {
  ATTACHMENT_VISIBILITY,
  type IAttachment,
} from "@/services/types/attachment";

interface IAttachmentPreviewProps {
  attachment: IAttachment;
}

const isImage = (mimeType: string) => mimeType.startsWith("image/");

export const AttachmentPreview = ({
  attachment,
}: IAttachmentPreviewProps) => {
  const [previewUrl, setPreviewUrl] = useState(attachment.url);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (
      !isImage(attachment.mimeType) ||
      attachment.visibility === ATTACHMENT_VISIBILITY.PUBLIC
    ) {
      setLoading(false);
      setPreviewUrl(attachment.url);
      return;
    }

    let cancelled = false;
    setLoading(true);

    GetAttachmentSignedUrl(attachment.id)
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
  }, [attachment.id, attachment.mimeType, attachment.url, attachment.visibility]);

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
