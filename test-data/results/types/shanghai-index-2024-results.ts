/**
 * ShanghaiIndex2024Results Type Definitions
 *
 * Auto-generated from shanghai-index-2024-results.json
 * Generated at: 2026-03-10T21:51:25.948Z
 */

// Import JSON data
import rawData from '../../results/json/shanghai-index-2024-results.json';

// Type definitions matching backend VO structures
export interface IShanghaiIndex2024ResultsK {
  id: number;
  symbol: string;
  time: Date | string;
  amount: number;
  open: number;
  close: number;
  highest: number;
  lowest: number;
}

export interface IShanghaiIndex2024ResultsMergeK {
  startTime: Date | string;
  endTime: Date | string;
  highest: number;
  lowest: number;
  trend: string;
  mergedCount: number;
  mergedIds: number[];
  mergedData: IShanghaiIndex2024ResultsK[];
}

export interface IShanghaiIndex2024ResultsBi {
  startTime: Date | string;
  endTime: Date | string;
  highest: number;
  lowest: number;
  trend: string;
  type: string;
  status: number;
  independentCount: number;
  originIds: number[];
  originData: IShanghaiIndex2024ResultsK[];
}

export interface IShanghaiIndex2024ResultsChannel {
  zg: number;
  zd: number;
  gg: number;
  dd: number;
  level: string;
  type: string;
  startId: number;
  endId: number;
  trend: string;
  bis: any[];
}

// Main data interface
export interface IShanghaiIndex2024ResultsData {
  metadata: any;
  summary: any;
  data: {
    originalKLines: IShanghaiIndex2024ResultsK[];
    mergeK: IShanghaiIndex2024ResultsMergeK[];
    bis: IShanghaiIndex2024ResultsBi[];
    channels: IShanghaiIndex2024ResultsChannel[];
  };
}

// Type assertion
export const shanghaiindex2024results: IShanghaiIndex2024ResultsData = rawData as unknown as IShanghaiIndex2024ResultsData;

// Convenience exports with export name for frontend
export const shanghaiindex2024resultsKLines = shanghaiindex2024results.data.originalKLines;
export const shanghaiindex2024resultsMergeK = shanghaiindex2024results.data.mergeK;
export const shanghaiindex2024resultsBi = shanghaiindex2024results.data.bis;
export const shanghaiindex2024resultsChannels = shanghaiindex2024results.data.channels;
export const shanghaiindex2024resultsSummary = shanghaiindex2024results.summary;
