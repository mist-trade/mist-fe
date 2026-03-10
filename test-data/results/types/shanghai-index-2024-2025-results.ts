/**
 * ShanghaiIndex20242025Results Type Definitions
 *
 * Auto-generated from shanghai-index-2024-2025-results.json
 * Generated at: 2026-03-10T21:51:25.948Z
 */

// Import JSON data
import rawData from '../../results/json/shanghai-index-2024-2025-results.json';

// Type definitions matching backend VO structures
export interface IShanghaiIndex20242025ResultsK {
  id: number;
  symbol: string;
  time: Date | string;
  amount: number;
  open: number;
  close: number;
  highest: number;
  lowest: number;
}

export interface IShanghaiIndex20242025ResultsMergeK {
  startTime: Date | string;
  endTime: Date | string;
  highest: number;
  lowest: number;
  trend: string;
  mergedCount: number;
  mergedIds: number[];
  mergedData: IShanghaiIndex20242025ResultsK[];
}

export interface IShanghaiIndex20242025ResultsBi {
  startTime: Date | string;
  endTime: Date | string;
  highest: number;
  lowest: number;
  trend: string;
  type: string;
  status: number;
  independentCount: number;
  originIds: number[];
  originData: IShanghaiIndex20242025ResultsK[];
}

export interface IShanghaiIndex20242025ResultsChannel {
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
export interface IShanghaiIndex20242025ResultsData {
  metadata: any;
  summary: any;
  data: {
    originalKLines: IShanghaiIndex20242025ResultsK[];
    mergeK: IShanghaiIndex20242025ResultsMergeK[];
    bis: IShanghaiIndex20242025ResultsBi[];
    channels: IShanghaiIndex20242025ResultsChannel[];
  };
}

// Type assertion
export const shanghaiindex20242025results: IShanghaiIndex20242025ResultsData = rawData as unknown as IShanghaiIndex20242025ResultsData;

// Convenience exports with export name for frontend
export const shanghaiindex20242025resultsKLines = shanghaiindex20242025results.data.originalKLines;
export const shanghaiindex20242025resultsMergeK = shanghaiindex20242025results.data.mergeK;
export const shanghaiindex20242025resultsBi = shanghaiindex20242025results.data.bis;
export const shanghaiindex20242025resultsChannels = shanghaiindex20242025results.data.channels;
export const shanghaiindex20242025resultsSummary = shanghaiindex20242025results.summary;
