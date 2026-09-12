import {
  LOG_CATEGORY,
  LOG_LEVEL,
  type LogLevel,
} from "@/services/types/log";
import { Button, DatePicker, Input, Select, Space } from "antd";

const { RangePicker } = DatePicker;

const LEVEL_OPTIONS = Object.values(LOG_LEVEL).map((level) => ({
  label: level.toUpperCase(),
  value: level,
}));

const CATEGORY_OPTIONS = Object.values(LOG_CATEGORY).map((category) => ({
  label: category,
  value: category,
}));

interface ILogFiltersProps {
  level?: LogLevel;
  category?: string;
  userId: string;
  keyword: string;
  onLevelChange: (level?: LogLevel) => void;
  onCategoryChange: (category?: string) => void;
  onUserIdChange: (userId: string) => void;
  onKeywordChange: (keyword: string) => void;
  onTimeRangeChange: (startTime?: string, endTime?: string) => void;
  onReset: () => void;
}

export const LogFilters = ({
  level,
  category,
  userId,
  keyword,
  onLevelChange,
  onCategoryChange,
  onUserIdChange,
  onKeywordChange,
  onTimeRangeChange,
  onReset,
}: ILogFiltersProps) => {
  return (
    <Space wrap size="small">
      <RangePicker
        showTime
        className="w-full sm:w-[360px]"
        onChange={(dates) =>
          onTimeRangeChange(
            dates?.[0]?.toISOString(),
            dates?.[1]?.toISOString(),
          )
        }
      />
      <Select
        allowClear
        placeholder="日志级别"
        value={level}
        options={LEVEL_OPTIONS}
        onChange={onLevelChange}
        className="w-[140px]"
      />
      <Select
        allowClear
        placeholder="日志类别"
        value={category}
        options={CATEGORY_OPTIONS}
        onChange={onCategoryChange}
        className="w-[160px]"
      />
      <Input
        allowClear
        placeholder="用户 ID"
        value={userId}
        onChange={(event) => onUserIdChange(event.target.value)}
        className="w-full sm:w-[180px]"
      />
      <Input
        allowClear
        placeholder="消息关键词"
        value={keyword}
        onChange={(event) => onKeywordChange(event.target.value)}
        className="w-full sm:w-[220px]"
      />
      <Button onClick={onReset}>重置</Button>
    </Space>
  );
};
