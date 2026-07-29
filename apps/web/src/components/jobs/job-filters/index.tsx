import { JOB_STATUS, type JobStatus } from "@/services/types/job";
import { Button, Input, Select, Space } from "antd";

const STATUS_OPTIONS = [
  { label: "排队中", value: JOB_STATUS.QUEUED },
  { label: "执行中", value: JOB_STATUS.ACTIVE },
  { label: "已完成", value: JOB_STATUS.COMPLETED },
  { label: "失败", value: JOB_STATUS.FAILED },
  { label: "延迟中", value: JOB_STATUS.DELAYED },
  { label: "已取消", value: JOB_STATUS.CANCELLED },
];

interface IJobFiltersProps {
  name?: string;
  status?: JobStatus;
  onNameChange: (name: string) => void;
  onStatusChange: (status?: JobStatus) => void;
  onReset: () => void;
}

export const JobFilters = ({
  name,
  status,
  onNameChange,
  onStatusChange,
  onReset,
}: IJobFiltersProps) => {
  return (
    <Space wrap>
      <Input
        allowClear
        placeholder="任务名称"
        value={name}
        onChange={(event) => onNameChange(event.target.value)}
        className="w-[220px]"
      />
      <Select
        allowClear
        placeholder="任务状态"
        value={status}
        options={STATUS_OPTIONS}
        onChange={onStatusChange}
        className="w-[160px]"
      />
      <Button onClick={onReset}>重置</Button>
    </Space>
  );
};
