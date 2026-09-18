import { ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import { Button, Input, Select, Space, Switch } from "antd";

import type { IFindManagementAttachmentsQuery } from "@/services/dtos/attachment-management";
import { ATTACHMENT_VISIBILITY } from "@/services/types/attachment";

const { Search } = Input;

interface IAttachmentFiltersProps {
  filters: IFindManagementAttachmentsQuery;
  loading?: boolean;
  onChange: (filters: IFindManagementAttachmentsQuery) => void;
  onRefresh: () => void;
}

export const AttachmentFilters = ({
  filters,
  loading,
  onChange,
  onRefresh,
}: IAttachmentFiltersProps) => {
  const updateFilters = (patch: Partial<IFindManagementAttachmentsQuery>) => {
    onChange({ ...filters, ...patch });
  };

  return (
    <Space wrap>
      <Search
        allowClear
        enterButton={<SearchOutlined />}
        placeholder="搜索文件名"
        value={filters.keyword}
        onChange={(event) =>
          updateFilters({ keyword: event.target.value || undefined })
        }
        style={{ width: 220 }}
      />
      <Input
        allowClear
        placeholder="MIME 类型"
        value={filters.mimeType}
        onChange={(event) =>
          updateFilters({ mimeType: event.target.value || undefined })
        }
        style={{ width: 180 }}
      />
      <Select
        allowClear
        placeholder="可见性"
        value={filters.visibility}
        onChange={(visibility) => updateFilters({ visibility })}
        options={[
          {
            value: ATTACHMENT_VISIBILITY.PRIVATE,
            label: "私有",
          },
          {
            value: ATTACHMENT_VISIBILITY.PUBLIC,
            label: "公开",
          },
        ]}
        style={{ width: 120 }}
      />
      <Space size="small">
        <span>包含已删除</span>
        <Switch
          checked={filters.includeDeleted}
          disabled={filters.orphanOnly}
          onChange={(includeDeleted) => updateFilters({ includeDeleted })}
        />
      </Space>
      <Space size="small">
        <span>仅孤儿附件</span>
        <Switch
          checked={filters.orphanOnly}
          onChange={(orphanOnly) =>
            updateFilters({ orphanOnly, includeDeleted: false })
          }
        />
      </Space>
      <Button icon={<ReloadOutlined />} loading={loading} onClick={onRefresh}>
        刷新
      </Button>
    </Space>
  );
};
