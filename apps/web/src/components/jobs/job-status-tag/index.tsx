import { JOB_STATUS, type JobStatus } from "@/services/types/job";
import { Tag } from "antd";

const JOB_STATUS_LABEL: Record<JobStatus, string> = {
  [JOB_STATUS.QUEUED]: "排队中",
  [JOB_STATUS.ACTIVE]: "执行中",
  [JOB_STATUS.COMPLETED]: "已完成",
  [JOB_STATUS.FAILED]: "失败",
  [JOB_STATUS.DELAYED]: "延迟中",
  [JOB_STATUS.CANCELLED]: "已取消",
};

const JOB_STATUS_COLOR: Record<JobStatus, string> = {
  [JOB_STATUS.QUEUED]: "default",
  [JOB_STATUS.ACTIVE]: "processing",
  [JOB_STATUS.COMPLETED]: "success",
  [JOB_STATUS.FAILED]: "error",
  [JOB_STATUS.DELAYED]: "warning",
  [JOB_STATUS.CANCELLED]: "default",
};

interface IJobStatusTagProps {
  status: JobStatus;
}

export const JobStatusTag = ({ status }: IJobStatusTagProps) => {
  return <Tag color={JOB_STATUS_COLOR[status]}>{JOB_STATUS_LABEL[status]}</Tag>;
};
