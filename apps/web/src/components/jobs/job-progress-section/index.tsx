import { JOB_STATUS, type JobStatus } from "@/services/types/job";
import { Progress, Space, Typography } from "antd";

const { Text } = Typography;

const getProgressStatus = (status: JobStatus) => {
  if (status === JOB_STATUS.FAILED) return "exception";
  if (status === JOB_STATUS.COMPLETED) return "success";
  return "active";
};

interface IJobProgressSectionProps {
  progress: number;
  status: JobStatus;
}

export const JobProgressSection = ({
  progress,
  status,
}: IJobProgressSectionProps) => {
  return (
    <Space direction="vertical" className="w-full" size={4}>
      <div className="flex items-center justify-between">
        <Text type="secondary">任务进度</Text>
        <Text strong>{progress}%</Text>
      </div>
      <Progress percent={progress} status={getProgressStatus(status)} />
    </Space>
  );
};
