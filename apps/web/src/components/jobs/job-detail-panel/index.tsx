import { JobProgressSection } from "@/components/jobs/job-progress-section";
import { JobStatusTag } from "@/components/jobs/job-status-tag";
import type { IJobRun } from "@/services/types/job";
import { Alert, Card, Descriptions, Empty, Space, Typography } from "antd";

const { Paragraph, Text } = Typography;

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  return new Date(value).toLocaleString();
};

const formatJson = (value: unknown) => {
  if (value === undefined || value === null) return "-";
  return JSON.stringify(value, null, 2);
};

interface IJobDetailPanelProps {
  job?: IJobRun;
  loading?: boolean;
  isFetching?: boolean;
}

export const JobDetailPanel = ({
  job,
  loading,
  isFetching,
}: IJobDetailPanelProps) => {
  if (!job) {
    return (
      <Card title="任务详情" className="h-full" loading={loading}>
        <Empty description="选择一条任务查看详情" />
      </Card>
    );
  }

  return (
    <Card title="任务详情" className="h-full" loading={loading}>
      <Space direction="vertical" size="middle" className="w-full">
        <Alert
          type="info"
          showIcon
          message="当前详情使用 Polling 刷新"
          description="SSE 后端接口已预留为第二种学习示例，前端本期暂不接入；轮询实现完整保留。"
        />

        <div className="flex items-center justify-between gap-3">
          <div>
            <Text strong>{job.name}</Text>
            <div className="text-xs text-gray-500">{job.id}</div>
          </div>
          <Space>
            {isFetching && <Text type="secondary">刷新中</Text>}
            <JobStatusTag status={job.status} />
          </Space>
        </div>

        <JobProgressSection progress={job.progress} status={job.status} />

        <Descriptions size="small" bordered column={1}>
          <Descriptions.Item label="队列">{job.queueName}</Descriptions.Item>
          <Descriptions.Item label="触发类型">{job.triggerType}</Descriptions.Item>
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
      </Space>
    </Card>
  );
};
