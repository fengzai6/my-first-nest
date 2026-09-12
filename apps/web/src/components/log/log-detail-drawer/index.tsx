import { LogLevelTag } from "@/components/log/log-level-tag";
import type { ILogRecord } from "@/services/types/log";
import { Descriptions, Drawer, Space, Spin, Typography } from "antd";

const { Paragraph, Text } = Typography;

const formatJson = (value: unknown) =>
  value === null || value === undefined ? "-" : JSON.stringify(value, null, 2);

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  return new Date(value).toLocaleString("zh-CN");
};

const renderText = (value?: string | number | null) =>
  value === null || value === undefined || value === "" ? "-" : String(value);

interface ILogDetailDrawerProps {
  log?: ILogRecord;
  loading?: boolean;
  open: boolean;
  onClose: () => void;
}

export const LogDetailDrawer = ({
  log,
  loading,
  open,
  onClose,
}: ILogDetailDrawerProps) => {
  return (
    <Drawer
      title="日志详情"
      open={open}
      width="min(720px, 100vw)"
      onClose={onClose}
    >
      {loading && <Spin />}

      {!loading && log && (
        <Space direction="vertical" size="large" className="w-full">
          <Descriptions size="small" bordered column={1}>
            <Descriptions.Item label="日志 ID">
              {log.id}
            </Descriptions.Item>
            <Descriptions.Item label="时间">
              {formatDateTime(log.timestamp)}
            </Descriptions.Item>
            <Descriptions.Item label="级别">
              <LogLevelTag level={log.level} />
            </Descriptions.Item>
            <Descriptions.Item label="类别">
              {log.category}
            </Descriptions.Item>
            <Descriptions.Item label="请求 ID">
              {renderText(log.requestId)}
            </Descriptions.Item>
            <Descriptions.Item label="用户 ID">
              {renderText(log.userId)}
            </Descriptions.Item>
            <Descriptions.Item label="IP">
              {renderText(log.ip)}
            </Descriptions.Item>
            <Descriptions.Item label="HTTP">
              {[log.method, log.url].filter(Boolean).join(" ") || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="状态码">
              {renderText(log.statusCode)}
            </Descriptions.Item>
            <Descriptions.Item label="耗时">
              {log.duration === null ? "-" : `${log.duration} ms`}
            </Descriptions.Item>
          </Descriptions>

          <div>
            <Text strong>消息</Text>
            <Paragraph className="mt-2 rounded bg-gray-50 p-3 text-sm" copyable>
              <span className="break-words">{log.message}</span>
            </Paragraph>
          </div>

          <div>
            <Text strong>context</Text>
            <Paragraph
              className="mt-2 rounded bg-gray-50 p-3 text-xs"
              copyable
            >
              <pre className="m-0 whitespace-pre-wrap break-words">
                {formatJson(log.context)}
              </pre>
            </Paragraph>
          </div>

          <div>
            <Text strong>stack</Text>
            <Paragraph
              className="mt-2 rounded bg-gray-50 p-3 text-xs"
              copyable
            >
              <pre className="m-0 whitespace-pre-wrap break-words">
                {log.stack || "-"}
              </pre>
            </Paragraph>
          </div>
        </Space>
      )}
    </Drawer>
  );
};
