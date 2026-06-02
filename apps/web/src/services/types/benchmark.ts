export interface IBenchmarkTimeResult {
  time?: string;
  totalTime?: string;
  avgTime?: string;
  result?: string;
  description?: string;
}

export interface IBenchmarkSingleResult {
  userId?: string;
  database?: IBenchmarkTimeResult;
  cached?: IBenchmarkTimeResult;
  speedup?: string;
  error?: string;
}

export interface IBenchmarkBatchResult {
  queryCount?: number;
  availableUsers?: number;
  database?: IBenchmarkTimeResult;
  cached?: IBenchmarkTimeResult;
  speedup?: string;
  error?: string;
}

export interface IBenchmarkScenarioResult {
  totalUsers?: number;
  coldStart?: IBenchmarkTimeResult;
  warmCache?: IBenchmarkTimeResult;
  improvement?: string;
  speedup?: string;
  error?: string;
}

export interface IThrottleLimitConfig {
  ttl: number;
  limit: number;
}

export interface IThrottleConfigResult {
  default: IThrottleLimitConfig;
  demo: IThrottleLimitConfig;
  storage: "redis" | "memory";
}

export interface IThrottleProbeResult {
  message: string;
  timestamp: string;
  limit: number;
  ttlMs: number;
}

export interface IHashDemoResult {
  key: string;
  ttlSeconds: number;
  redisEnabled: boolean;
  fields: Record<string, string>;
  updatedField?: string;
  updatedValue?: number;
  deleted?: number;
}

export interface ISetHashFieldDto {
  field: string;
  value: string;
}

export interface IIncrementHashFieldDto {
  field: string;
  increment?: number;
}
