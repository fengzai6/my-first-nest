import { LogDetailDrawer } from "@/components/log/log-detail-drawer";
import { LogFilters } from "@/components/log/log-filters";
import { LogTable } from "@/components/log/log-table";
import { GetLog } from "@/services/api/logs";
import { useLogsList } from "@/services/hooks/use-logs-list";
import type { ILogRecord, LogLevel } from "@/services/types/log";
import { ReloadOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { Alert, Button, Typography } from "antd";
import { useState } from "react";

const { Title } = Typography;

export const Logs = () => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [level, setLevel] = useState<LogLevel>();
  const [category, setCategory] = useState<string>();
  const [userId, setUserId] = useState("");
  const [keyword, setKeyword] = useState("");
  const [startTime, setStartTime] = useState<string>();
  const [endTime, setEndTime] = useState<string>();
  const [filterResetKey, setFilterResetKey] = useState(0);
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);

  const logsQuery = useLogsList({
    page,
    pageSize,
    level,
    category,
    userId: userId || undefined,
    keyword: keyword || undefined,
    startTime,
    endTime,
  });

  const detailQuery = useQuery({
    queryKey: ["logs", "detail", selectedLogId],
    queryFn: () => GetLog(selectedLogId as string),
    enabled: selectedLogId !== null,
  });

  const handleTimeRangeChange = (nextStartTime?: string, nextEndTime?: string) => {
    setStartTime(nextStartTime);
    setEndTime(nextEndTime);
    setPage(1);
  };

  const handleLevelChange = (nextLevel?: LogLevel) => {
    setLevel(nextLevel);
    setPage(1);
  };

  const handleCategoryChange = (nextCategory?: string) => {
    setCategory(nextCategory);
    setPage(1);
  };

  const handleUserIdChange = (nextUserId: string) => {
    setUserId(nextUserId);
    setPage(1);
  };

  const handleKeywordChange = (nextKeyword: string) => {
    setKeyword(nextKeyword);
    setPage(1);
  };

  const handleResetFilters = () => {
    setLevel(undefined);
    setCategory(undefined);
    setUserId("");
    setKeyword("");
    setStartTime(undefined);
    setEndTime(undefined);
    setPage(1);
    setFilterResetKey((key) => key + 1);
  };

  const handleSelectLog = (log: ILogRecord) => {
    setSelectedLogId(log.id);
  };

  const handleCloseDetail = () => {
    setSelectedLogId(null);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col p-6">
      <div className="mb-4 flex shrink-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Title level={2} className="mb-0!">
          日志
        </Title>
        <Button
          icon={<ReloadOutlined />}
          loading={logsQuery.isFetching}
          onClick={() => logsQuery.refetch()}
        >
          刷新
        </Button>
      </div>

      <div className="mb-4 shrink-0 rounded-lg border border-slate-200 bg-white p-4">
        <LogFilters
          key={filterResetKey}
          level={level}
          category={category}
          userId={userId}
          keyword={keyword}
          onLevelChange={handleLevelChange}
          onCategoryChange={handleCategoryChange}
          onUserIdChange={handleUserIdChange}
          onKeywordChange={handleKeywordChange}
          onTimeRangeChange={handleTimeRangeChange}
          onReset={handleResetFilters}
        />
      </div>

      {logsQuery.isError && (
        <Alert
          type="error"
          showIcon
          className="mb-4"
          message="日志列表加载失败"
          description={logsQuery.error.message}
          action={
            <Button
              size="small"
              icon={<ReloadOutlined />}
              onClick={() => logsQuery.refetch()}
            >
              重试
            </Button>
          }
        />
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white">
        <LogTable
          logs={logsQuery.data?.items ?? []}
          total={logsQuery.data?.total ?? 0}
          page={page}
          pageSize={pageSize}
          loading={logsQuery.isLoading}
          onSelectLog={handleSelectLog}
          onPaginationChange={(nextPage, nextPageSize) => {
            setPage(nextPage);
            setPageSize(nextPageSize);
          }}
        />
      </div>

      <LogDetailDrawer
        log={detailQuery.data}
        loading={detailQuery.isLoading}
        error={detailQuery.error}
        open={selectedLogId !== null}
        onRetry={() => detailQuery.refetch()}
        onClose={handleCloseDetail}
      />
    </div>
  );
};
