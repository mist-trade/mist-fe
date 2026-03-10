/**
 * Test Data Unified Export
 *
 * Centralized export point for all test data fixtures.
 * Provides environment-based dataset selection and type-safe exports.
 *
 * @module test-data
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

/**
 * Available dataset names for environment-based selection
 */
export const DATASET = {
  DEVELOPMENT: 'development',
  TESTING: 'testing',
  PRODUCTION: 'production',
} as const;

/**
 * Dataset type for type-safe dataset selection
 */
export type Dataset = typeof DATASET[keyof typeof DATASET];

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

/**
 * Mock dataset registry mapping environments to their data sources
 *
 * - development: Real 2025 CSI-300 data (full year)
 * - testing: Simplified 2024-2025 data for faster tests
 * - production: Empty array (no mock data in production)
 */
const MOCK_DATASETS: Record<Dataset, MockDataItem[]> = {
  development: _mockCSI300Data2025Real,
  testing: _mockKData,
  production: [],
};

/**
 * Determines the active dataset based on environment variables
 *
 * Resolution order:
 * 1. NEXT_PUBLIC_MOCK_DATASET (explicit override)
 * 2. NODE_ENV (test -> testing, otherwise -> development)
 * 3. Default to development
 *
 * @returns The active dataset name
 */
const getDataset = (): Dataset => {
  if (typeof process === "undefined") return DATASET.DEVELOPMENT;
  const env = process.env.NODE_ENV || "development";

  // Check for explicit dataset override
  if (process.env.NEXT_PUBLIC_MOCK_DATASET) {
    const override = process.env.NEXT_PUBLIC_MOCK_DATASET as Dataset;
    if (override === DATASET.DEVELOPMENT || override === DATASET.TESTING || override === DATASET.PRODUCTION) {
      return override;
    }
  }

  // Map NODE_ENV to dataset
  return env === "test" ? DATASET.TESTING : DATASET.DEVELOPMENT;
};

/**
 * Get mock data based on the current environment
 *
 * Returns the appropriate dataset synchronously based on environment configuration.
 * Use this function in server components or client code that needs test data.
 *
 * @returns Array of mock K-line data items
 *
 * @example
 * ```typescript
 * // In server component
 * import { getMockData } from '@/test-data';
 * const data = await getMockData();
 *
 * // In client component
 * import { getMockData } from '@/test-data';
 * const data = getMockData(); // No await needed for synchronous access
 * ```
 */
export const getMockData = (): MockDataItem[] => {
  const dataset = getDataset();
  return MOCK_DATASETS[dataset];
};
