import { LogLevelTag } from "@/components/log/log-level-tag";
import { useElementHeight } from "@/hooks/use-element-height";
import type { ILogRecord } from "@/services/types/log";
import { EyeOutlined } from "@ant-design/icons";
import {
  Button,
  Pagination,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type { ColumnsType, TableRef } from "antd/es/table";
import { useEffect, useRef, useState } from "react";

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
  const { elementRef: tableRegionRef, height: tableRegionHeight } =
    useElementHeight();
  const tableRef = useRef<TableRef | null>(null);
  const [tableHeaderHeight, setTableHeaderHeight] = useState(56);

  useEffect(() => {
    const tableElement = tableRef.current?.nativeElement;
    if (!tableElement) return;

    const updateTableHeaderHeight = () => {
      const headerElement = tableElement.querySelector<HTMLElement>(
        ".ant-table-thead",
      );
      if (headerElement) {
        setTableHeaderHeight(headerElement.getBoundingClientRect().height);
      }
    };

    updateTableHeaderHeight();

    const resizeObserver = new ResizeObserver(updateTableHeaderHeight);
    resizeObserver.observe(tableElement);
    return () => resizeObserver.disconnect();
  }, []);

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
    <div className="flex h-full min-h-0 flex-col">
      <div ref={tableRegionRef} className="min-h-0 flex-1">
        <Table
          ref={tableRef}
          columns={columns}
          dataSource={logs}
          rowKey="id"
          loading={loading}
          scroll={{
            x: 1250,
            y: Math.max(tableRegionHeight - tableHeaderHeight - 1, 120),
          }}
          pagination={false}
        />
      </div>
      <div className="shrink-0 border-t border-slate-200 px-4 py-3">
        <Pagination
          current={page}
          pageSize={pageSize}
          total={total}
          showSizeChanger
          showQuickJumper
          showTotal={(totalCount, range) =>
            `第 ${range[0]}-${range[1]} 条，共 ${totalCount} 条`
          }
          onChange={onPaginationChange}
        />
      </div>
    </div>
  );
};
