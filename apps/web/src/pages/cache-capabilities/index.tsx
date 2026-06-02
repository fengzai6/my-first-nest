import {
  DeleteOutlined,
  FieldTimeOutlined,
  PlusOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Input,
  InputNumber,
  message,
  Space,
  Statistic,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useState } from "react";

import {
  DeleteHashField,
  GetBenchmarkBatch,
  GetBenchmarkScenario,
  GetBenchmarkSingle,
  GetHashDemo,
  GetThrottleConfig,
  GetThrottleProbe,
  IncrementHashField,
  SetHashField,
} from "@/services/api/benchmark";
import type { IHashDemoResult } from "@/services/types/benchmark";

const { Title, Text } = Typography;

interface IThrottleLog {
  id: number;
  status: "success" | "error";
  message: string;
  timestamp: string;
}

interface IHashFieldRow {
  field: string;
  value: string;
}

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  return "请求失败";
};

const getErrorStatus = (error: unknown) => {
  if (typeof error !== "object" || error === null || !("status" in error)) {
    return undefined;
  }

  const status = error.status;
  return typeof status === "number" ? status : undefined;
};

const formatMs = (value?: number) => {
  if (typeof value !== "number") return "-";
  return `${value}ms`;
};

const getHashRows = (hash?: IHashDemoResult): IHashFieldRow[] => {
  return Object.entries(hash?.fields ?? {}).map(([field, value]) => ({
    field,
    value,
  }));
};

export const CacheCapabilities = () => {
  const [batchCount, setBatchCount] = useState(100);
  const [hashField, setHashField] = useState("score");
  const [hashValue, setHashValue] = useState("1");
  const [incrementField, setIncrementField] = useState("views");
  const [increment, setIncrement] = useState(1);
  const [throttleLogs, setThrottleLogs] = useState<IThrottleLog[]>([]);

  const queryClient = useQueryClient();

  const singleQuery = useQuery({
    queryKey: ["benchmark", "single"],
    queryFn: () => GetBenchmarkSingle(),
  });

  const batchQuery = useQuery({
    queryKey: ["benchmark", "batch", batchCount],
    queryFn: () => GetBenchmarkBatch(batchCount),
  });

  const scenarioQuery = useQuery({
    queryKey: ["benchmark", "scenario"],
    queryFn: GetBenchmarkScenario,
  });

  const throttleConfigQuery = useQuery({
    queryKey: ["benchmark", "throttle", "config"],
    queryFn: GetThrottleConfig,
  });

  const hashQuery = useQuery({
    queryKey: ["benchmark", "hash"],
    queryFn: GetHashDemo,
  });

  const throttleProbeMutation = useMutation({
    mutationFn: GetThrottleProbe,
    onSuccess: (data) => {
      const log: IThrottleLog = {
        id: Date.now(),
        status: "success",
        message: data.message,
        timestamp: new Date(data.timestamp).toLocaleTimeString(),
      };

      setThrottleLogs((prev) => [log, ...prev].slice(0, 8));
    },
    onError: (error: unknown) => {
      const status = getErrorStatus(error);
      const log: IThrottleLog = {
        id: Date.now(),
        status: "error",
        message:
          status === 429 ? "触发限流：请求过于频繁" : getErrorMessage(error),
        timestamp: new Date().toLocaleTimeString(),
      };

      setThrottleLogs((prev) => [log, ...prev].slice(0, 8));
    },
  });

  const setHashFieldMutation = useMutation({
    mutationFn: SetHashField,
    onSuccess: () => {
      message.success("Hash 字段已写入");
      queryClient.invalidateQueries({ queryKey: ["benchmark", "hash"] });
    },
    onError: (error: unknown) => {
      message.error(getErrorMessage(error));
    },
  });

  const incrementHashFieldMutation = useMutation({
    mutationFn: IncrementHashField,
    onSuccess: () => {
      message.success("Hash 字段已自增");
      queryClient.invalidateQueries({ queryKey: ["benchmark", "hash"] });
    },
    onError: (error: unknown) => {
      message.error(getErrorMessage(error));
    },
  });

  const deleteHashFieldMutation = useMutation({
    mutationFn: DeleteHashField,
    onSuccess: () => {
      message.success("Hash 字段已删除");
      queryClient.invalidateQueries({ queryKey: ["benchmark", "hash"] });
    },
    onError: (error: unknown) => {
      message.error(getErrorMessage(error));
    },
  });

  const handleRefreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ["benchmark"] });
  };

  const handleSetHashField = () => {
    if (!hashField.trim() || !hashValue.trim()) return;

    setHashFieldMutation.mutate({
      field: hashField.trim(),
      value: hashValue.trim(),
    });
  };

  const handleIncrementHashField = () => {
    if (!incrementField.trim()) return;

    incrementHashFieldMutation.mutate({
      field: incrementField.trim(),
      increment,
    });
  };

  const hashColumns: ColumnsType<IHashFieldRow> = [
    {
      title: "字段",
      dataIndex: "field",
      key: "field",
      width: 180,
    },
    {
      title: "值",
      dataIndex: "value",
      key: "value",
    },
    {
      title: "操作",
      key: "actions",
      width: 96,
      render: (_, record) => (
        <Tooltip title="删除字段">
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            loading={deleteHashFieldMutation.isPending}
            onClick={() => deleteHashFieldMutation.mutate(record.field)}
          />
        </Tooltip>
      ),
    },
  ];

  return (
    <div className="flex-1 space-y-6 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Title level={2} className="mb-1!">
            缓存能力
          </Title>
          <Text type="secondary">
            Redis 缓存性能、接口限流和 Hash 字段级缓存
          </Text>
        </div>
        <Button
          icon={<ReloadOutlined />}
          onClick={handleRefreshAll}
          loading={
            singleQuery.isFetching ||
            batchQuery.isFetching ||
            scenarioQuery.isFetching ||
            throttleConfigQuery.isFetching ||
            hashQuery.isFetching
          }
        >
          刷新
        </Button>
      </div>

      <section className="space-y-3">
        <Title level={4} className="mb-0!">
          缓存性能
        </Title>
        <div className="grid gap-4 lg:grid-cols-3">
          <Card size="small" title="单次查询">
            {singleQuery.data?.error ? (
              <Alert type="warning" message={singleQuery.data.error} />
            ) : (
              <Space direction="vertical" className="w-full">
                <Descriptions size="small" column={1}>
                  <Descriptions.Item label="数据库">
                    {singleQuery.data?.database?.time ?? "-"}
                  </Descriptions.Item>
                  <Descriptions.Item label="缓存">
                    {singleQuery.data?.cached?.time ?? "-"}
                  </Descriptions.Item>
                </Descriptions>
                <Statistic
                  title="加速比"
                  value={singleQuery.data?.speedup ?? "-"}
                />
              </Space>
            )}
          </Card>

          <Card size="small" title="批量查询">
            {batchQuery.data?.error ? (
              <Alert type="warning" message={batchQuery.data.error} />
            ) : (
              <Space direction="vertical" className="w-full">
                <Space>
                  <InputNumber
                    min={1}
                    max={1000}
                    value={batchCount}
                    onChange={(value) => setBatchCount(value ?? 100)}
                  />
                  <Button
                    icon={<ReloadOutlined />}
                    onClick={() => batchQuery.refetch()}
                    loading={batchQuery.isFetching}
                  >
                    执行
                  </Button>
                </Space>
                <Descriptions size="small" column={1}>
                  <Descriptions.Item label="数据库">
                    {batchQuery.data?.database?.totalTime ?? "-"}
                  </Descriptions.Item>
                  <Descriptions.Item label="缓存">
                    {batchQuery.data?.cached?.totalTime ?? "-"}
                  </Descriptions.Item>
                </Descriptions>
                <Statistic
                  title="加速比"
                  value={batchQuery.data?.speedup ?? "-"}
                />
              </Space>
            )}
          </Card>

          <Card size="small" title="冷热缓存">
            {scenarioQuery.data?.error ? (
              <Alert type="warning" message={scenarioQuery.data.error} />
            ) : (
              <Space direction="vertical" className="w-full">
                <Descriptions size="small" column={1}>
                  <Descriptions.Item label="冷启动">
                    {scenarioQuery.data?.coldStart?.totalTime ?? "-"}
                  </Descriptions.Item>
                  <Descriptions.Item label="热缓存">
                    {scenarioQuery.data?.warmCache?.totalTime ?? "-"}
                  </Descriptions.Item>
                </Descriptions>
                <Space size="large">
                  <Statistic
                    title="提升"
                    value={scenarioQuery.data?.improvement ?? "-"}
                  />
                  <Statistic
                    title="加速比"
                    value={scenarioQuery.data?.speedup ?? "-"}
                  />
                </Space>
              </Space>
            )}
          </Card>
        </div>
      </section>

      <Card title="接口限流" size="small">
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <Space direction="vertical" className="w-full">
            <Descriptions size="small" column={1}>
              <Descriptions.Item label="默认窗口">
                {formatMs(throttleConfigQuery.data?.default.ttl)}
              </Descriptions.Item>
              <Descriptions.Item label="默认额度">
                {throttleConfigQuery.data?.default.limit ?? "-"}
              </Descriptions.Item>
              <Descriptions.Item label="演示窗口">
                {formatMs(throttleConfigQuery.data?.demo.ttl)}
              </Descriptions.Item>
              <Descriptions.Item label="演示额度">
                {throttleConfigQuery.data?.demo.limit ?? "-"}
              </Descriptions.Item>
              <Descriptions.Item label="存储">
                <Tag
                  color={
                    throttleConfigQuery.data?.storage === "redis"
                      ? "green"
                      : "default"
                  }
                >
                  {throttleConfigQuery.data?.storage ?? "-"}
                </Tag>
              </Descriptions.Item>
            </Descriptions>
            <Button
              type="primary"
              icon={<ThunderboltOutlined />}
              onClick={() => throttleProbeMutation.mutate()}
              loading={throttleProbeMutation.isPending}
            >
              调用探测接口
            </Button>
          </Space>

          <div className="min-h-48 rounded border border-gray-200 p-3">
            {throttleLogs.length === 0 ? (
              <Text type="secondary">暂无调用记录</Text>
            ) : (
              <Space direction="vertical" className="w-full">
                {throttleLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between gap-3"
                  >
                    <Space>
                      <Tag color={log.status === "success" ? "green" : "red"}>
                        {log.status === "success" ? "成功" : "限流/错误"}
                      </Tag>
                      <Text>{log.message}</Text>
                    </Space>
                    <Text type="secondary">{log.timestamp}</Text>
                  </div>
                ))}
              </Space>
            )}
          </div>
        </div>
      </Card>

      <Card title="Hash 字段级缓存" size="small">
        <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
          <Space direction="vertical" className="w-full">
            <Descriptions size="small" column={1}>
              <Descriptions.Item label="Key">
                {hashQuery.data?.key ?? "-"}
              </Descriptions.Item>
              <Descriptions.Item label="TTL">
                {hashQuery.data?.ttlSeconds
                  ? `${hashQuery.data.ttlSeconds}s`
                  : "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Redis">
                <Tag color={hashQuery.data?.redisEnabled ? "green" : "default"}>
                  {hashQuery.data?.redisEnabled ? "enabled" : "memory fallback"}
                </Tag>
              </Descriptions.Item>
            </Descriptions>

            <Space.Compact className="w-full">
              <Input
                value={hashField}
                placeholder="field"
                onChange={(event) => setHashField(event.target.value)}
              />
              <Input
                value={hashValue}
                placeholder="value"
                onChange={(event) => setHashValue(event.target.value)}
              />
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleSetHashField}
                loading={setHashFieldMutation.isPending}
              >
                写入
              </Button>
            </Space.Compact>

            <Space.Compact className="w-full">
              <Input
                value={incrementField}
                placeholder="field"
                onChange={(event) => setIncrementField(event.target.value)}
              />
              <InputNumber
                className="w-24!"
                value={increment}
                min={-1000}
                max={1000}
                onChange={(value) =>
                  setIncrement(typeof value === "number" ? value : 1)
                }
              />
              <Button
                icon={<FieldTimeOutlined />}
                onClick={handleIncrementHashField}
                loading={incrementHashFieldMutation.isPending}
              >
                自增
              </Button>
            </Space.Compact>
          </Space>

          <Table
            size="small"
            rowKey="field"
            columns={hashColumns}
            dataSource={getHashRows(hashQuery.data)}
            loading={hashQuery.isLoading}
            pagination={false}
          />
        </div>
      </Card>
    </div>
  );
};
