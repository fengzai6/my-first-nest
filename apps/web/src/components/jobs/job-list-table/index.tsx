import { JobStatusTag } from "@/components/jobs/job-status-tag";
import { DataTable } from "@/components/data-table";
import {
  JOB_CANCELLABLE_STATUSES,
  type IJobRun,
} from "@/services/types/job";
import { EyeOutlined, StopOutlined } from "@ant-design/icons";
import { Button, Popconfirm, Progress, Space, Tooltip, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";

const { Text } = Typography;

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  return new Date(value).toLocaleString();
};

interface IJobListTableProps {
  jobs: IJobRun[];
  total: number;
  page: number;
  pageSize: number;
  loading?: boolean;
  selectedJobId?: string | null;
  cancellingJobId?: string | null;
  onSelectJob: (job: IJobRun) => void;
  onCancelJob: (job: IJobRun) => void;
  onPaginationChange: (page: number, pageSize: number) => void;
}

export const JobListTable = ({
  jobs,
  total,
  page,
  pageSize,
  loading,
  selectedJobId,
  cancellingJobId,
  onSelectJob,
  onCancelJob,
  onPaginationChange,
}: IJobListTableProps) => {
  const columns: ColumnsType<IJobRun> = [
    {
      title: "任务",
      dataIndex: "name",
      key: "name",
      width: 220,
      render: (name: string, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{name}</Text>
          <Text type="secondary" className="text-xs">
            {record.id}
          </Text>
        </Space>
      ),
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 110,
      render: (_, record) => <JobStatusTag status={record.status} />,
    },
    {
      title: "进度",
      dataIndex: "progress",
      key: "progress",
      width: 180,
      render: (progress: number) => <Progress percent={progress} size="small" />,
    },
    {
      title: "触发",
      dataIndex: "triggerType",
      key: "triggerType",
      width: 100,
    },
    {
      title: "创建时间",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 190,
      render: formatDateTime,
    },
    {
      title: "错误摘要",
      dataIndex: "errorMessage",
      key: "errorMessage",
      ellipsis: true,
      render: (errorMessage?: string | null) => errorMessage || "-",
    },
    {
      title: "操作",
      key: "actions",
      width: 130,
      fixed: "right",
      render: (_, record) => {
        const canCancel = JOB_CANCELLABLE_STATUSES.includes(record.status);
        return (
          <Space size="small">
            <Tooltip title="查看详情">
              <Button
                type="text"
                icon={<EyeOutlined />}
                onClick={() => onSelectJob(record)}
              />
            </Tooltip>
            <Popconfirm
              title="取消任务"
              description="仅 queued / delayed 任务可取消。"
              disabled={!canCancel}
              onConfirm={() => onCancelJob(record)}
              okText="确认"
              cancelText="取消"
            >
              <Tooltip title={canCancel ? "取消任务" : "当前状态不可取消"}>
                <Button
                  type="text"
                  danger
                  disabled={!canCancel}
                  icon={<StopOutlined />}
                  loading={cancellingJobId === record.id}
                />
              </Tooltip>
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  return (
    <DataTable
      columns={columns}
      dataSource={jobs}
      rowKey="id"
      loading={loading}
      page={page}
      pageSize={pageSize}
      total={total}
      scrollX={1100}
      rowClassName={(record) =>
        record.id === selectedJobId ? "bg-blue-50" : "cursor-pointer"
      }
      onRow={(record) => ({
        onClick: () => onSelectJob(record),
      })}
      onPaginationChange={onPaginationChange}
    />
  );
};
