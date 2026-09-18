import { ClearOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Card, Descriptions, message, Progress, Tag } from "antd";

import { JobStatusTag } from "@/components/jobs/job-status-tag";
import {
  GetLatestManagementCleanup,
  TriggerManagementCleanup,
} from "@/services/api/attachment-management";
import type { IJobRun } from "@/services/types/attachment-management";

interface IAttachmentCleanupCardProps {
  canManage: boolean;
}

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  return new Date(value).toLocaleString("zh-CN");
};

const formatResult = (job?: IJobRun | null) => {
  if (!job?.result) return "-";
  return JSON.stringify(job.result, null, 2);
};

export const AttachmentCleanupCard = ({
  canManage,
}: IAttachmentCleanupCardProps) => {
  const queryClient = useQueryClient();
  const cleanupQuery = useQuery({
    queryKey: ["attachments-management", "cleanup-latest"],
    queryFn: GetLatestManagementCleanup,
  });
  const triggerMutation = useMutation({
    mutationFn: TriggerManagementCleanup,
    onSuccess: () => {
      message.success("附件清理任务已提交");
      queryClient.invalidateQueries({
        queryKey: ["attachments-management", "cleanup-latest"],
      });
    },
    onError: (error: Error) =>
      message.error(error.message || "附件清理任务提交失败"),
  });
  const job = cleanupQuery.data;

  return (
    <Card
      title="最近清理任务"
      extra={
        <Button
          icon={<ClearOutlined />}
          disabled={!canManage}
          loading={triggerMutation.isPending}
          onClick={() => triggerMutation.mutate()}
        >
          触发清理
        </Button>
      }
    >
      {job ? (
        <Descriptions column={1} size="small">
          <Descriptions.Item label="状态">
            <JobStatusTag status={job.status} />
          </Descriptions.Item>
          <Descriptions.Item label="进度">
            <Progress percent={job.progress} size="small" />
          </Descriptions.Item>
          <Descriptions.Item label="结果">
            <pre className="m-0 text-xs break-words whitespace-pre-wrap">
              {formatResult(job)}
            </pre>
          </Descriptions.Item>
          <Descriptions.Item label="失败原因">
            {job.errorMessage || "-"}
          </Descriptions.Item>
          <Descriptions.Item label="完成时间">
            {formatDateTime(job.finishedAt)}
          </Descriptions.Item>
        </Descriptions>
      ) : (
        <Tag>暂无清理任务</Tag>
      )}
    </Card>
  );
};
