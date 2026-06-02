import type {
  IBenchmarkBatchResult,
  IBenchmarkScenarioResult,
  IBenchmarkSingleResult,
  IHashDemoResult,
  IIncrementHashFieldDto,
  ISetHashFieldDto,
  IThrottleConfigResult,
  IThrottleProbeResult,
} from "../types/benchmark";
import http from "./new-http";

export const GetBenchmarkSingle = async (id?: string) => {
  const res = await http.get<IBenchmarkSingleResult>("/benchmark/single", {
    params: { id },
  });

  return res.data;
};

export const GetBenchmarkBatch = async (count = 100) => {
  const res = await http.get<IBenchmarkBatchResult>("/benchmark/batch", {
    params: { count },
  });

  return res.data;
};

export const GetBenchmarkScenario = async () => {
  const res = await http.get<IBenchmarkScenarioResult>("/benchmark/scenario");

  return res.data;
};

export const GetThrottleConfig = async () => {
  const res = await http.get<IThrottleConfigResult>(
    "/benchmark/throttle/config",
  );

  return res.data;
};

export const GetThrottleProbe = async () => {
  const res = await http.get<IThrottleProbeResult>("/benchmark/throttle/probe");

  return res.data;
};

export const GetHashDemo = async () => {
  const res = await http.get<IHashDemoResult>("/benchmark/hash");

  return res.data;
};

export const SetHashField = async (data: ISetHashFieldDto) => {
  const res = await http.post<IHashDemoResult>("/benchmark/hash/field", data);

  return res.data;
};

export const IncrementHashField = async (data: IIncrementHashFieldDto) => {
  const res = await http.post<IHashDemoResult>(
    "/benchmark/hash/increment",
    data,
  );

  return res.data;
};

export const DeleteHashField = async (field: string) => {
  const res = await http.delete<IHashDemoResult>(
    `/benchmark/hash/field/${encodeURIComponent(field)}`,
  );

  return res.data;
};
