import {
  CopyOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EyeOutlined,
  LinkOutlined,
  SwapOutlined,
} from "@ant-design/icons";
import { Button, Dropdown, message, Popconfirm, Space, Tooltip } from "antd";
import { useState } from "react";

import {
  createAttachmentDownloadUrl,
  resolveAttachmentUrl,
} from "@/components/attachment-upload/attachment-link";
import { downloadAttachment } from "@/pages/documents/components/attachment-download";
import {
  GetManagementAttachmentSignedUrl,
  SoftDeleteManagementAttachment,
  UpdateManagementAttachmentVisibility,
} from "@/services/api/attachment-management";
import {
  ATTACHMENT_VISIBILITY,
  type AttachmentVisibility,
} from "@/services/types/attachment";
import type { IManagementAttachment } from "@/services/types/attachment-management";

interface IAttachmentActionsProps {
  attachment: IManagementAttachment;
  canManage: boolean;
  onView: (attachment: IManagementAttachment) => void;
  onRefresh: () => void;
}

type AttachmentAction = "copy" | "open" | "download";

export const AttachmentActions = ({
  attachment,
  canManage,
  onView,
  onRefresh,
}: IAttachmentActionsProps) => {
  const [loadingAction, setLoadingAction] = useState<AttachmentAction | null>(
    null,
  );
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const isMutable = canManage && attachment.status === "orphan";
  const mutableDisabledReason =
    attachment.status === "deleted"
      ? "已删除附件不能修改"
      : attachment.status === "bound"
        ? "已绑定附件不能修改，请回到业务模块处理"
        : !canManage
          ? "没有附件管理权限"
          : undefined;

  const runAction = async (action: AttachmentAction) => {
    setLoadingAction(action);

    try {
      const { url } = await GetManagementAttachmentSignedUrl(attachment.id);
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

      await downloadAttachment(
        createAttachmentDownloadUrl(absoluteUrl, window.location.origin),
        attachment.originalName,
      );
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

  const handleVisibilityChange = async (visibility: AttachmentVisibility) => {
    setIsUpdating(true);

    try {
      await UpdateManagementAttachmentVisibility(attachment.id, visibility);
      message.success("附件可见性已更新");
      onRefresh();
    } catch (error) {
      message.error(
        error instanceof Error ? error.message : "附件可见性更新失败",
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);

    try {
      await SoftDeleteManagementAttachment(attachment.id);
      message.success("附件已软删除");
      onRefresh();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "附件删除失败");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Space size="small">
      <Tooltip title="查看详情">
        <Button
          type="text"
          aria-label={`查看 ${attachment.originalName} 详情`}
          icon={<EyeOutlined />}
          onClick={() => onView(attachment)}
        />
      </Tooltip>
      <Tooltip title="复制链接">
        <Button
          type="text"
          aria-label={`复制 ${attachment.originalName} 链接`}
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
      <Tooltip title={mutableDisabledReason}>
        <Dropdown
          disabled={!isMutable || isUpdating}
          menu={{
            items: Object.values(ATTACHMENT_VISIBILITY).map((visibility) => ({
              key: visibility,
              label:
                visibility === ATTACHMENT_VISIBILITY.PUBLIC
                  ? "设为公开"
                  : "设为私有",
              disabled: attachment.visibility === visibility,
              onClick: () => void handleVisibilityChange(visibility),
            })),
          }}
        >
          <Button
            type="text"
            aria-label={`修改 ${attachment.originalName} 可见性`}
            icon={<SwapOutlined />}
            loading={isUpdating}
            disabled={!isMutable}
          />
        </Dropdown>
      </Tooltip>
      <Popconfirm
        title="确认软删除"
        description="软删除后附件会进入清理任务候选范围。"
        disabled={!isMutable}
        onConfirm={() => void handleDelete()}
        okText="确认"
        cancelText="取消"
      >
        <Tooltip title={mutableDisabledReason}>
          <Button
            type="text"
            danger
            aria-label={`删除 ${attachment.originalName}`}
            icon={<DeleteOutlined />}
            loading={isDeleting}
            disabled={!isMutable}
          />
        </Tooltip>
      </Popconfirm>
    </Space>
  );
};
