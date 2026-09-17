import type {
  ISubmitExportReportDto,
  ISubmitFlakyRetryDto,
} from "@/services/dtos/job";
import {
  ClearOutlined,
  FileExcelOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import {
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Space,
  Typography,
} from "antd";

const { Text } = Typography;

interface IJobTriggerPanelProps {
  loading?: boolean;
  onSubmitExportReport: (data: ISubmitExportReportDto) => void;
  onSubmitFlakyRetry: (data: ISubmitFlakyRetryDto) => void;
  onSubmitCleanup: () => void;
  onSubmitCleanupAttachments: () => void;
}

export const JobTriggerPanel = ({
  loading,
  onSubmitExportReport,
  onSubmitFlakyRetry,
  onSubmitCleanup,
  onSubmitCleanupAttachments,
}: IJobTriggerPanelProps) => {
  return (
    <Card title="手动触发" className="h-full">
      <Space direction="vertical" size="large" className="w-full">
        <Form
          layout="vertical"
          initialValues={{
            title: "monthly-report",
            steps: 5,
            stepDelayMs: 500,
          }}
          onFinish={onSubmitExportReport}
        >
          <Text strong>export-report</Text>
          <Form.Item name="title" label="标题" className="mt-3">
            <Input placeholder="monthly-report" />
          </Form.Item>
          <div className="grid grid-cols-2 gap-3">
            <Form.Item name="steps" label="步骤数">
              <InputNumber min={1} max={20} className="w-full" />
            </Form.Item>
            <Form.Item name="stepDelayMs" label="步骤间隔(ms)">
              <InputNumber min={100} max={5000} step={100} className="w-full" />
            </Form.Item>
          </div>
          <Button
            htmlType="submit"
            icon={<FileExcelOutlined />}
            loading={loading}
            block
          >
            触发导出
          </Button>
        </Form>

        <Form
          layout="vertical"
          initialValues={{ failTimes: 2 }}
          onFinish={onSubmitFlakyRetry}
        >
          <Text strong>flaky-retry</Text>
          <Form.Item name="failTimes" label="失败次数" className="mt-3">
            <InputNumber min={0} max={5} className="w-full" />
          </Form.Item>
          <Button
            htmlType="submit"
            icon={<ThunderboltOutlined />}
            loading={loading}
            block
          >
            触发重试任务
          </Button>
        </Form>

        <Button
          icon={<ClearOutlined />}
          loading={loading}
          onClick={onSubmitCleanup}
          block
        >
          清理过期 refresh token
        </Button>

        <Button
          icon={<ClearOutlined />}
          loading={loading}
          onClick={onSubmitCleanupAttachments}
          block
        >
          清理附件
        </Button>
      </Space>
    </Card>
  );
};
