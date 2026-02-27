/**
 * Types for displaying test statistics in the statistics panel
 */

export interface TestStatistics {
  metadata: {
    testName: string;
    timestamp: string;
    dataSource: string;
    dateRange: string;
  };
  marketStats: {
    highest: number;
    lowest: number;
    yearStart2024: number;
    yearEnd2024: number;
    yearReturn2024: number;
  };
  dataStats: {
    totalKLines: number;
    totalMergeK: number;
    mergeRatio: number;
    dataBreakdown: string;
  };
  biStats: {
    total: number;
    complete: number;
    uncomplete: number;
    up: number;
    down: number;
    avgDuration: number;
    maxDuration: number;
    minDuration: number;
  };
  channelStats: {
    total: number;
    complete: number;
    uncomplete: number;
    channels: ChannelDetail[];
  };
}

export interface ChannelDetail {
  index: number;
  priceRange: { zd: number; zg: number };
  fullRange: { dd: number; gg: number };
  biCount: number;
  width: number;
  widthPercent: number;
}
