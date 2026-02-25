import { mockCSI300Data2025Real } from "../mock-csi300-2025-real";
import { mockKData3002025 } from "../mock-300-2025";
import type { IFetchK } from "../fetch";

type Dataset = "development" | "testing" | "production";

const MOCK_DATASETS: Record<Dataset, IFetchK[]> = {
  development: mockCSI300Data2025Real, // 开发用：大数据集
  testing: mockKData3002025, // 测试用：特定模式
  production: [], // 生产环境：禁用 mock
};

const getDataset = (): Dataset => {
  const env = process.env.NODE_ENV || "development";
  if (process.env.NEXT_PUBLIC_MOCK_DATASET) {
    return process.env.NEXT_PUBLIC_MOCK_DATASET as Dataset;
  }
  return env === "test" ? "testing" : "development";
};

export const getMockData = async (): Promise<IFetchK[]> => {
  const dataset = getDataset();
  return MOCK_DATASETS[dataset];
};
