import { DataTable } from "@/components/data-table";
import { LogLevelTag } from "@/components/log/log-level-tag";
import type { ILogRecord } from "@/services/types/log";
import { EyeOutlined } from "@ant-design/icons";
import { Button, Space, Tag, Tooltip, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";

const { Text } = Typography;

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("zh-CN");

interface ILogTableProps {
  logs: ILogRecord[];
  total: number;
  page: number;
  pageSize: number;
  loading?: boolean;
  onSelectLog: (log: ILogRecord) => void;
  onPaginationChange: (page: number, pageSize: number) => void;
}

export const LogTable = ({
  logs,
  total,
  page,
  pageSize,
  loading,
  onSelectLog,
  onPaginationChange,
}: ILogTableProps) => {
  const columns: ColumnsType<ILogRecord> = [
    {
      title: "时间",
      dataIndex: "timestamp",
      key: "timestamp",
      width: 190,
      render: formatDateTime,
    },
    {
      title: "级别",
      dataIndex: "level",
      key: "level",
      width: 88,
      render: (_, record) => <LogLevelTag level={record.level} />,
    },
    {
      title: "类别",
      dataIndex: "category",
      key: "category",
      width: 120,
      ellipsis: true,
    },
    {
      title: "用户",
      dataIndex: "userId",
      key: "userId",
      width: 150,
      ellipsis: true,
      render: (userId: string | null) => userId || "-",
    },
    {
      title: "HTTP",
      key: "http",
      width: 280,
      ellipsis: true,
      render: (_, record) => {
        if (!record.method && !record.url) return "-";

        return (
          <Space size={4}>
            {record.method && <Tag className="m-0">{record.method}</Tag>}
            <Text ellipsis>{record.url || "-"}</Text>
          </Space>
        );
      },
    },
    {
      title: "消息",
      dataIndex: "message",
      key: "message",
      ellipsis: true,
    },
    {
      title: "耗时",
      dataIndex: "duration",
      key: "duration",
      width: 90,
      render: (duration: number | null) =>
        duration === null ? "-" : `${duration} ms`,
    },
    {
      title: "操作",
      key: "actions",
      width: 56,
      fixed: "right",
      render: (_, record) => (
        <Tooltip title="查看详情">
          <Button
            type="text"
            aria-label="查看日志详情"
            icon={<EyeOutlined />}
            onClick={() => onSelectLog(record)}
          />
        </Tooltip>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      dataSource={logs}
      rowKey="id"
      loading={loading}
      page={page}
      pageSize={pageSize}
      total={total}
      scrollX={1250}
      onPaginationChange={onPaginationChange}
    />
  );
};
