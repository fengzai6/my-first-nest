import { JobProgressSection } from "@/components/jobs/job-progress-section";
import { JobRefreshModeToggle } from "@/components/jobs/job-refresh-mode-toggle";
import { JobStatusTag } from "@/components/jobs/job-status-tag";
import {
  JOB_REFRESH_MODE,
  type IJobRun,
  type JobRefreshMode,
} from "@/services/types/job";
import { Alert, Button, Card, Descriptions, Empty, Space, Tag, Typography } from "antd";
import type { SseState } from "fzkit/http-client";

const { Paragraph, Text } = Typography;

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  return new Date(value).toLocaleString();
};

const formatJson = (value: unknown) => {
  if (value === undefined || value === null) return "-";
  return JSON.stringify(value, null, 2);
};

const SSE_CONNECTION_STATUS: Record<
  SseState,
  { color: string; label: string }
> = {
  connecting: { color: "processing", label: "连接中" },
  open: { color: "success", label: "已连接" },
  retrying: { color: "warning", label: "重连中" },
  closed: { color: "default", label: "已关闭" },
};

interface IJobDetailPanelProps {
  job?: IJobRun;
  loading?: boolean;
  isFetching?: boolean;
  error?: Error | null;
  refreshMode: JobRefreshMode;
  connectionState: SseState;
  lastEventAt: number | null;
  onRefreshModeChange: (mode: JobRefreshMode) => void;
  onRetry?: () => void;
}

export const JobDetailPanel = ({
  job,
  loading,
  isFetching,
  error,
  refreshMode,
  connectionState,
  lastEventAt,
  onRefreshModeChange,
  onRetry,
}: IJobDetailPanelProps) => {
  const isSseMode = refreshMode === JOB_REFRESH_MODE.SSE;
  const sseConnection = SSE_CONNECTION_STATUS[connectionState];

  return (
    <Card
      title="任务详情"
      className="h-full"
      loading={loading && !error}
      extra={
        <JobRefreshModeToggle
          mode={refreshMode}
          onChange={onRefreshModeChange}
        />
      }
    >
      <Space direction="vertical" size="middle" className="w-full">
        {error && (
          <Alert
            type="error"
            showIcon
            message="任务详情刷新失败"
            description={error.message}
            action={
              onRetry ? (
                <Button size="small" onClick={onRetry}>
                  重试
                </Button>
              ) : undefined
            }
          />
        )}

        {!job && <Empty description="选择一条任务查看详情" />}

        {job && (
          <>
            <div className="flex items-center justify-between gap-3">
              <div>
                <Text strong>{job.name}</Text>
                <div className="text-xs text-gray-500">{job.id}</div>
              </div>
              <Space>
                {isSseMode ? (
                  <>
                    <Tag color={sseConnection.color}>
                      SSE {sseConnection.label}
                    </Tag>
                    {lastEventAt && (
                      <Text type="secondary" className="text-xs">
                        最近事件 {new Date(lastEventAt).toLocaleTimeString()}
                      </Text>
                    )}
                  </>
                ) : (
                  isFetching && <Text type="secondary">刷新中</Text>
                )}
                <JobStatusTag status={job.status} />
              </Space>
            </div>

            <JobProgressSection progress={job.progress} status={job.status} />

            <Descriptions size="small" bordered column={1}>
              <Descriptions.Item label="队列">{job.queueName}</Descriptions.Item>
              <Descriptions.Item label="触发类型">
                {job.triggerType}
              </Descriptions.Item>
              <Descriptions.Item label="尝试次数">
                {job.attemptsMade} / {job.maxAttempts}
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {formatDateTime(job.createdAt)}
              </Descriptions.Item>
              <Descriptions.Item label="开始时间">
                {formatDateTime(job.startedAt)}
              </Descriptions.Item>
              <Descriptions.Item label="结束时间">
                {formatDateTime(job.finishedAt)}
              </Descriptions.Item>
            </Descriptions>

            <div>
              <Text strong>payload</Text>
              <Paragraph className="mt-2 rounded bg-gray-50 p-3 text-xs" copyable>
                <pre className="m-0 whitespace-pre-wrap break-words">
                  {formatJson(job.payload)}
                </pre>
              </Paragraph>
            </div>

            <div>
              <Text strong>result</Text>
              <Paragraph className="mt-2 rounded bg-gray-50 p-3 text-xs" copyable>
                <pre className="m-0 whitespace-pre-wrap break-words">
                  {formatJson(job.result)}
                </pre>
              </Paragraph>
            </div>

            <div>
              <Text strong>errorMessage</Text>
              <Paragraph className="mt-2 rounded bg-gray-50 p-3 text-xs" copyable>
                <pre className="m-0 whitespace-pre-wrap break-words">
                  {job.errorMessage || "-"}
                </pre>
              </Paragraph>
            </div>
          </>
        )}
      </Space>
    </Card>
  );
};
