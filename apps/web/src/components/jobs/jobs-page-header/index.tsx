import { DashboardOutlined, ReloadOutlined } from "@ant-design/icons";
import { Button, Space, Typography } from "antd";

const { Text, Title } = Typography;

interface IJobsPageHeaderProps {
  loading?: boolean;
  onRefresh: () => void;
  onOpenBoard: () => void;
}

export const JobsPageHeader = ({
  loading,
  onRefresh,
  onOpenBoard,
}: IJobsPageHeaderProps) => {
  return (
    <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <Title level={2} className="!mb-1">
          任务中心
        </Title>
        <Text type="secondary">业务任务看 job_runs，队列内部状态看 Bull Board。</Text>
      </div>
      <Space wrap>
        <Button icon={<ReloadOutlined />} loading={loading} onClick={onRefresh}>
          刷新列表
        </Button>
        <Button icon={<DashboardOutlined />} onClick={onOpenBoard}>
          队列监控
        </Button>
      </Space>
    </div>
  );
};
