import { JobDetailPanel } from "@/components/jobs/job-detail-panel";
import { JobFilters } from "@/components/jobs/job-filters";
import { JobListTable } from "@/components/jobs/job-list-table";
import { JobTriggerPanel } from "@/components/jobs/job-trigger-panel";
import { JobsPageHeader } from "@/components/jobs/jobs-page-header";
import {
  SubmitCleanupExpiredRefreshTokens,
  SubmitExportReport,
  SubmitFlakyRetry,
} from "@/services/api/background-tasks";
import { CancelJob } from "@/services/api/jobs";
import type {
  ISubmitExportReportDto,
  ISubmitFlakyRetryDto,
} from "@/services/dtos/job";
import { useJobPolling } from "@/services/hooks/use-job-polling";
import { useJobsList } from "@/services/hooks/use-jobs-list";
import type { IJobRun, JobStatus } from "@/services/types/job";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Card, message } from "antd";
import { useState } from "react";

export const Jobs = () => {
  const [name, setName] = useState("");
  const [status, setStatus] = useState<JobStatus | undefined>();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [cancellingJobId, setCancellingJobId] = useState<string | null>(null);

  const queryClient = useQueryClient();

  const jobsQuery = useJobsList({
    page,
    pageSize,
    name: name || undefined,
    status,
  });
  const jobDetailQuery = useJobPolling(selectedJobId);

  const handleJobSubmitted = (job: IJobRun) => {
    message.success("任务已提交");
    setSelectedJobId(job.id);
    queryClient.invalidateQueries({ queryKey: ["jobs"] });
  };

  const exportReportMutation = useMutation({
    mutationFn: SubmitExportReport,
    onSuccess: handleJobSubmitted,
    onError: (error: Error) => message.error(error.message || "提交失败"),
  });

  const flakyRetryMutation = useMutation({
    mutationFn: SubmitFlakyRetry,
    onSuccess: handleJobSubmitted,
    onError: (error: Error) => message.error(error.message || "提交失败"),
  });

  const cleanupMutation = useMutation({
    mutationFn: SubmitCleanupExpiredRefreshTokens,
    onSuccess: handleJobSubmitted,
    onError: (error: Error) => message.error(error.message || "提交失败"),
  });

  const cancelMutation = useMutation({
    mutationFn: CancelJob,
    onMutate: (jobId: string) => setCancellingJobId(jobId),
    onSuccess: (job) => {
      message.success("任务已取消");
      setSelectedJobId(job.id);
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
    onError: (error: Error) => message.error(error.message || "取消失败"),
    onSettled: () => setCancellingJobId(null),
  });

  const jobsPage = jobsQuery.data;
  const jobs = jobsPage?.list ?? [];
  const triggerLoading =
    exportReportMutation.isPending ||
    flakyRetryMutation.isPending ||
    cleanupMutation.isPending;

  const handleNameChange = (nextName: string) => {
    setName(nextName);
    setPage(1);
  };

  const handleStatusChange = (nextStatus?: JobStatus) => {
    setStatus(nextStatus);
    setPage(1);
  };

  const handleResetFilters = () => {
    setName("");
    setStatus(undefined);
    setPage(1);
  };

  const handleOpenBoard = () => {
    window.open("/admin/queues", "_blank", "noopener,noreferrer");
  };

  const handleSubmitExportReport = (data: ISubmitExportReportDto) => {
    exportReportMutation.mutate(data);
  };

  const handleSubmitFlakyRetry = (data: ISubmitFlakyRetryDto) => {
    flakyRetryMutation.mutate(data);
  };

  return (
    <div className="p-6">
      <JobsPageHeader
        loading={jobsQuery.isFetching}
        onRefresh={() => jobsQuery.refetch()}
        onOpenBoard={handleOpenBoard}
      />

      <Alert
        type="info"
        showIcon
        className="mb-4"
        message="轮询与 SSE 是两种学习示例"
        description="本期前端任务详情使用 GET /api/jobs/:id 轮询；服务端已提供 SSE 事件接口供单独验证，后续再接入前端切换。"
      />

      {jobsQuery.isError && (
        <Alert
          type="error"
          showIcon
          className="mb-4"
          message="任务列表加载失败"
          description={jobsQuery.error.message}
          action={
            <Button size="small" onClick={() => jobsQuery.refetch()}>
              重试
            </Button>
          }
        />
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <JobTriggerPanel
          loading={triggerLoading}
          onSubmitExportReport={handleSubmitExportReport}
          onSubmitFlakyRetry={handleSubmitFlakyRetry}
          onSubmitCleanup={() => cleanupMutation.mutate()}
        />

        <Card
          title="任务列表"
          extra={
            <JobFilters
              name={name}
              status={status}
              onNameChange={handleNameChange}
              onStatusChange={handleStatusChange}
              onReset={handleResetFilters}
            />
          }
        >
          <JobListTable
            jobs={jobs}
            total={jobsPage?.total ?? 0}
            page={page}
            pageSize={pageSize}
            loading={jobsQuery.isLoading}
            selectedJobId={selectedJobId}
            cancellingJobId={cancellingJobId}
            onSelectJob={(job) => setSelectedJobId(job.id)}
            onCancelJob={(job) => cancelMutation.mutate(job.id)}
            onPaginationChange={(nextPage, nextPageSize) => {
              setPage(nextPage);
              setPageSize(nextPageSize);
            }}
          />
        </Card>
      </div>

      <div className="mt-4">
        <JobDetailPanel
          job={jobDetailQuery.data}
          loading={jobDetailQuery.isLoading}
          isFetching={jobDetailQuery.isFetching}
          error={jobDetailQuery.error}
          onRetry={() => jobDetailQuery.refetch()}
        />
      </div>
    </div>
  );
};
