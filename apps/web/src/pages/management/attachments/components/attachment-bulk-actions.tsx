import {
  DeleteOutlined,
  LockOutlined,
  UnlockOutlined,
} from "@ant-design/icons";
import { Button, message, Popconfirm, Space, Typography } from "antd";

import {
  BulkSoftDeleteManagementAttachments,
  BulkUpdateManagementVisibility,
} from "@/services/api/attachment-management";
import { ATTACHMENT_VISIBILITY } from "@/services/types/attachment";
import type { IAttachmentBulkResult } from "@/services/types/attachment-management";

const { Text } = Typography;

interface IAttachmentBulkActionsProps {
  selectedIds: string[];
  canManage: boolean;
  loading?: boolean;
  onChangeLoading: (loading: boolean) => void;
  onFinished: () => void;
}

export const AttachmentBulkActions = ({
  selectedIds,
  canManage,
  loading,
  onChangeLoading,
  onFinished,
}: IAttachmentBulkActionsProps) => {
  const showResult = (result: IAttachmentBulkResult) => {
    if (result.failed.length === 0) {
      message.success(`成功 ${result.succeeded.length} 条`);
      return;
    }

    message.warning(
      `成功 ${result.succeeded.length} 条，失败 ${result.failed.length} 条`,
    );
  };

  const runBulkAction = async (
    action: () => Promise<IAttachmentBulkResult>,
  ) => {
    onChangeLoading(true);

    try {
      showResult(await action());
      onFinished();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "批量操作失败");
    } finally {
      onChangeLoading(false);
    }
  };

  const isDisabled = !canManage || selectedIds.length === 0 || loading;

  return (
    <Space>
      <Text type="secondary">已选 {selectedIds.length} 条</Text>
      <Button
        icon={<UnlockOutlined />}
        disabled={isDisabled}
        onClick={() =>
          void runBulkAction(() =>
            BulkUpdateManagementVisibility(
              selectedIds,
              ATTACHMENT_VISIBILITY.PUBLIC,
            ),
          )
        }
      >
        设为公开
      </Button>
      <Button
        icon={<LockOutlined />}
        disabled={isDisabled}
        onClick={() =>
          void runBulkAction(() =>
            BulkUpdateManagementVisibility(
              selectedIds,
              ATTACHMENT_VISIBILITY.PRIVATE,
            ),
          )
        }
      >
        设为私有
      </Button>
      <Popconfirm
        title="确认批量软删除"
        description="仅未绑定附件会成功，已绑定附件会逐条返回失败。"
        disabled={isDisabled}
        onConfirm={() =>
          void runBulkAction(() =>
            BulkSoftDeleteManagementAttachments(selectedIds),
          )
        }
        okText="确认"
        cancelText="取消"
      >
        <Button danger icon={<DeleteOutlined />} disabled={isDisabled}>
          软删除
        </Button>
      </Popconfirm>
    </Space>
  );
};
