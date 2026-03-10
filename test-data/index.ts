/**
 * Test Data Unified Export
 *
 * Centralized export point for all test data
 */

// K-line fixtures
export { mockKData, getMockKData } from './fixtures/k-line/csi-300-2024-2025-simple';
export {
  mockCSIData300Real,
  getRealCSIData,
  getCSIDataByDateRange,
} from './fixtures/k-line/csi-300-2023-real';
export {
  mockKData3002025,
  getMockKData3002025,
} from './fixtures/k-line/csi-300-2025-full-year';
export {
  mockCSI300Data2025Real,
} from './fixtures/k-line/csi-300-2025-real';

// Re-import for typing
import { mockKData as _mockKData } from './fixtures/k-line/csi-300-2024-2025-simple';
import { mockCSI300Data2025Real as _mockCSI300Data2025Real } from './fixtures/k-line/csi-300-2025-real';

type Dataset = "development" | "testing" | "production";

// Import IFetchK type for proper typing
type MockDataItem = {
  id: number;
  symbol: string;
  time: Date;
  amount: number;
  open: number;
  close: number;
  highest: number;
  lowest: number;
};

const MOCK_DATASETS: Record<Dataset, MockDataItem[]> = {
  development: _mockCSI300Data2025Real,
  testing: _mockKData,
  production: [],
};

const getDataset = (): Dataset => {
  if (typeof process === "undefined") return "development";
  const env = process.env.NODE_ENV || "development";
  if (process.env.NEXT_PUBLIC_MOCK_DATASET) {
    return process.env.NEXT_PUBLIC_MOCK_DATASET as Dataset;
  }
  return env === "test" ? "testing" : "development";
};

/**
 * Get mock data based on environment
 */
export const getMockData = async (): Promise<MockDataItem[]> => {
  const dataset = getDataset();
  return MOCK_DATASETS[dataset];
};
