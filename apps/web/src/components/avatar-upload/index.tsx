import { LoadingOutlined, PlusOutlined } from "@ant-design/icons";
import { Avatar, message, Upload } from "antd";
import type { UploadProps } from "antd";
import { useState } from "react";

import { UploadAttachment } from "@/services/api/attachment";
import { ATTACHMENT_VISIBILITY } from "@/services/types/attachment";

const AVATAR_MAX_SIZE = 2 * 1024 * 1024;
const AVATAR_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

interface IAvatarUploadProps {
  value?: { avatarUrl?: string; attachmentId?: string };
  disabled?: boolean;
  onChange?: (value: { avatarUrl?: string; attachmentId?: string }) => void;
}

export const AvatarUpload = ({
  value,
  disabled,
  onChange,
}: IAvatarUploadProps) => {
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>();

  const beforeUpload: UploadProps["beforeUpload"] = (file) => {
    if (!AVATAR_MIME_TYPES.includes(file.type)) {
      message.error("头像仅支持 JPEG、PNG、WebP 格式");
      return Upload.LIST_IGNORE;
    }

    if (file.size > AVATAR_MAX_SIZE) {
      message.error("头像大小不能超过 2 MB");
      return Upload.LIST_IGNORE;
    }

    return true;
  };

  const handleUpload: UploadProps["customRequest"] = async ({
    file,
    onSuccess,
    onError,
  }) => {
    setLoading(true);

    try {
      const uploadFile = file as File;
      const [attachment] = await UploadAttachment({
        files: [uploadFile],
        visibility: ATTACHMENT_VISIBILITY.PUBLIC,
      });

      setPreviewUrl(attachment.url);
      onChange?.({
        avatarUrl: attachment.url,
        attachmentId: attachment.id,
      });
      onSuccess?.(attachment);
    } catch (error) {
      onError?.(error as Error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Upload
      accept="image/jpeg,image/png,image/webp"
      showUploadList={false}
      beforeUpload={beforeUpload}
      customRequest={handleUpload}
      disabled={disabled || loading}
    >
      <button
        type="button"
        className="flex size-20 cursor-pointer items-center justify-center rounded-full border border-dashed border-slate-300 bg-slate-50 p-0"
        aria-label="上传头像"
      >
        {loading ? (
          <LoadingOutlined />
        ) : previewUrl || value?.avatarUrl ? (
          <Avatar size={80} src={previewUrl || value?.avatarUrl} />
        ) : (
          <PlusOutlined />
        )}
      </button>
    </Upload>
  );
};
