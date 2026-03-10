/**
 * Placeholder for backend test results
 *
 * This file will be replaced by the sync script when backend tests are run.
 * The sync pipeline works as follows:
 * 1. Backend runs tests to generate JSON results in test-data/test-results/raw/
 * 2. Backend runs tools/generate-type-definitions.js to create TypeScript definitions
 * 3. Backend sync script copies types to frontend test-data/results/types/
 *
 * For now, this placeholder uses the fixture data directly to unblock the build.
 */

import { mockKData } from "@/test-data/fixtures/k-line/csi-300-2024-2025-simple";

export const shanghaiIndex2024_2025Results = {
  data: {
    originalKLines: mockKData,
    mergeK: [],
    bis: [],
    channels: [],
  },
  summary: {
    totalKLines: mockKData.length,
    dateRange: {
      start: mockKData[0]?.time,
      end: mockKData[mockKData.length - 1]?.time,
    },
  },
  metadata: {
    source: "placeholder",
    generatedAt: new Date().toISOString(),
    note: "This is a placeholder. Run backend tests and sync script to get actual results.",
  },
};
