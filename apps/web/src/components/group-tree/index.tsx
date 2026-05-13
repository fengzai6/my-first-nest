import { TeamOutlined } from "@ant-design/icons";
import { Empty, Spin, Tag, Tree } from "antd";
import type { TreeDataNode } from "antd";
import type { ReactNode } from "react";

import type { IGroup } from "@/services/types/group";

interface IGroupTreeProps {
  groups: IGroup[];
  loading?: boolean;
  emptyText?: string;
  renderExtra?: (group: IGroup) => ReactNode;
}

const buildTreeData = (
  groups: IGroup[],
  renderExtra?: (group: IGroup) => ReactNode,
): TreeDataNode[] => {
  return groups.map((group) => ({
    key: group.id,
    title: (
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center">
          <TeamOutlined className="mr-2 shrink-0" />
          <span className="truncate font-medium">{group.name}</span>
          {group.isOrganization && (
            <Tag color="orange" className="ml-2">
              组织
            </Tag>
          )}
          <Tag color="blue" className="ml-1">
            {group.members?.length || 0} 人
          </Tag>
        </div>
        {renderExtra ? <div className="shrink-0">{renderExtra(group)}</div> : null}
      </div>
    ),
    children:
      group.children.length > 0
        ? buildTreeData(group.children, renderExtra)
        : undefined,
  }));
};

export const GroupTree = ({
  groups,
  loading = false,
  emptyText = "暂无群组数据",
  renderExtra,
}: IGroupTreeProps) => {
  if (!loading && groups.length === 0) {
    return <Empty description={emptyText} />;
  }

  return (
    <Spin spinning={loading}>
      <Tree
        treeData={buildTreeData(groups, renderExtra)}
        defaultExpandAll
        showLine
        blockNode
      />
    </Spin>
  );
};
