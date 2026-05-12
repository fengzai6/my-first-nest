import { useQuery } from "@tanstack/react-query";
import { Alert, Card, Typography } from "antd";

import { GroupTree } from "@/components/group-tree";
import { GetGroupTreesByUser } from "@/services/api/group";
import { useUserStore } from "@/stores/user";

const { Title, Text } = Typography;

export const Home = () => {
  const user = useUserStore((state) => state.user);
  const {
    data: groupTrees = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["groups", "treesByUser"],
    queryFn: GetGroupTreesByUser,
  });

  return (
    <div className="flex-1 space-y-6 p-6">
      <div>
        <Title level={2} className="mb-1!">
          Home
        </Title>
        <Text className="text-lg">Hello, {user?.username}</Text>
      </div>

      <Card title="我的群组">
        {error ? (
          <Alert
            type="error"
            showIcon
            message="群组数据加载失败"
            description={(error as Error).message}
          />
        ) : (
          <GroupTree
            groups={groupTrees}
            loading={isLoading}
            emptyText="当前用户暂无可展示的群组"
          />
        )}
      </Card>
    </div>
  );
};
