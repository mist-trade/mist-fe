/**
 * Csi3002025Results Type Definitions
 *
 * Auto-generated from csi300-2025-results.json
 * Generated at: 2026-03-10T21:51:25.947Z
 */

// Import JSON data
import rawData from '../../results/json/csi300-2025-results.json';

// Type definitions matching backend VO structures
export interface ICsi3002025ResultsK {
  id: number;
  symbol: string;
  time: Date | string;
  amount: number;
  open: number;
  close: number;
  highest: number;
  lowest: number;
}

export interface ICsi3002025ResultsMergeK {
  startTime: Date | string;
  endTime: Date | string;
  highest: number;
  lowest: number;
  trend: string;
  mergedCount: number;
  mergedIds: number[];
  mergedData: ICsi3002025ResultsK[];
}

export interface ICsi3002025ResultsBi {
  startTime: Date | string;
  endTime: Date | string;
  highest: number;
  lowest: number;
  trend: string;
  type: string;
  status: number;
  independentCount: number;
  originIds: number[];
  originData: ICsi3002025ResultsK[];
}

export interface ICsi3002025ResultsChannel {
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
export interface ICsi3002025ResultsData {
  metadata: any;
  summary: any;
  data: {
    originalKLines: ICsi3002025ResultsK[];
    mergeK: ICsi3002025ResultsMergeK[];
    bis: ICsi3002025ResultsBi[];
    channels: ICsi3002025ResultsChannel[];
  };
}

// Type assertion
export const csi3002025results: ICsi3002025ResultsData = rawData as unknown as ICsi3002025ResultsData;

// Convenience exports with export name for frontend
export const csi3002025resultsKLines = csi3002025results.data.originalKLines;
export const csi3002025resultsMergeK = csi3002025results.data.mergeK;
export const csi3002025resultsBi = csi3002025results.data.bis;
export const csi3002025resultsChannels = csi3002025results.data.channels;
export const csi3002025resultsSummary = csi3002025results.summary;
