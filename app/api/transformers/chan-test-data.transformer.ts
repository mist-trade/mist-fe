import {
  IFetchK,
  IFetchBi,
  IFetchChannel,
  TrendDirection,
  BiType,
  ChannelType,
  ChannelLevel,
} from '../fetch';

/**
 * Backend Chan test results structure (from test JSON)
 */
export interface BackendChanTestResults {
  metadata: {
    testName: string;
    timestamp: string;
    dataSource: string;
    dataRange: {
      start: string;
      end: string;
      totalDays: number;
      breakdown: {
        2024: number;
        2025: number;
      };
    };
    marketStats: {
      highest: number;
      lowest: number;
      yearStart2024: number;
      yearEnd2024: number;
      yearReturn2024: number;
    };
  };
  summary: {
    originalKLines: number;
    mergedKLines: number;
    mergeRatio: number;
    totalBis: number;
    completeBis: number;
    uncompleteBis: number;
    upBis: number;
    downBis: number;
    totalChannels: number;
    completeChannels: number;
    uncompleteChannels: number;
  };
  biStatistics: {
    averageDuration: number;
    maxDuration: number;
    minDuration: number;
  };
  data: {
    originalKLines: BackendKLine[];
    mergedKLines: BackendMergeK[];
    bis: BackendBi[];
    channels: BackendChannel[];
  };
}

interface BackendKLine {
  id: number;
  symbol: string;
  time: string; // ISO string
  amount: number;
  open: number;
  close: number;
  highest: number;
  lowest: number;
}

interface BackendMergeK {
  startTime: string;
  endTime: string;
  highest: number;
  lowest: number;
  trend: string;
  mergedCount: number;
  mergedIds: number[];
  mergedData: BackendKLine[];
}

interface BackendFenxing {
  type: 'top' | 'bottom';
  highest: number;
  lowest: number;
  leftIds: number[];
  middleIds: number[];
  middleIndex: number;
  rightIds: number[];
  middleOriginId: number;
  leftValid: boolean;
  rightValid: boolean;
  erased: boolean;
}

interface BackendBi {
  startTime: string;
  endTime: string;
  highest: number;
  lowest: number;
  trend: string;
  type: string;
  originIds: number[];
  originData: BackendKLine[];
  independentCount: number;
  startFenxing: BackendFenxing;
  endFenxing: BackendFenxing;
}

interface BackendChannel {
  zg: number;
  zd: number;
  gg: number;
  dd: number;
  bis: BackendBi[];
  level: string;
  type: string;
  startId: number;
  endId: number;
  trend: string;
}

/**
 * Frontend compatible data structure
 */
export interface FrontendChanTestData {
  kLines: IFetchK[];
  mergeK: any[]; // Using any for mergedK as it's not exported from fetch.ts
  bis: IFetchBi[];
  channels: IFetchChannel[];
  statistics: TestStatistics;
}

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

/**
 * Transform backend K-line to frontend format
 */
function transformKLine(backendK: BackendKLine): IFetchK {
  return {
    ...backendK,
    time: new Date(backendK.time),
  };
}

/**
 * Transform backend Bi to frontend format
 */
function transformBi(backendBi: BackendBi): IFetchBi {
  return {
    startTime: new Date(backendBi.startTime),
    endTime: new Date(backendBi.endTime),
    highest: backendBi.highest,
    lowest: backendBi.lowest,
    trend: backendBi.trend as TrendDirection,
    type: backendBi.type as BiType,
    independentCount: backendBi.independentCount,
    originIds: backendBi.originIds,
    originData: backendBi.originData.map(transformKLine),
    // Note: startFenxing and endFenxing are not in IFetchBi interface
    // but included here for potential future use
  } as IFetchBi;
}

/**
 * Transform backend Channel to frontend format
 */
function transformChannel(backendChannel: BackendChannel): IFetchChannel {
  return {
    zg: backendChannel.zg,
    zd: backendChannel.zd,
    gg: backendChannel.gg,
    dd: backendChannel.dd,
    bis: backendChannel.bis.map(transformBi),
    level: backendChannel.level as ChannelLevel,
    type: backendChannel.type as ChannelType,
    startId: backendChannel.startId,
    endId: backendChannel.endId,
    trend: backendChannel.trend as TrendDirection,
  };
}

/**
 * Extract statistics for the statistics panel
 */
function extractStatistics(backendResults: BackendChanTestResults): TestStatistics {
  const { metadata, summary, biStatistics, data } = backendResults;

  // Calculate channel details
  const channelDetails: ChannelDetail[] = data.channels.map((ch, idx) => {
    const width = ch.zg - ch.zd;
    const widthPercent = (width / ch.zd) * 100;

    return {
      index: idx + 1,
      priceRange: { zd: ch.zd, zg: ch.zg },
      fullRange: { dd: ch.dd, gg: ch.gg },
      biCount: ch.bis.length,
      width,
      widthPercent,
    };
  });

  return {
    metadata: {
      testName: metadata.testName,
      timestamp: metadata.timestamp,
      dataSource: metadata.dataSource,
      dateRange: `${metadata.dataRange.start} to ${metadata.dataRange.end}`,
    },
    marketStats: {
      highest: metadata.marketStats.highest,
      lowest: metadata.marketStats.lowest,
      yearStart2024: metadata.marketStats.yearStart2024,
      yearEnd2024: metadata.marketStats.yearEnd2024,
      yearReturn2024: metadata.marketStats.yearReturn2024,
    },
    dataStats: {
      totalKLines: summary.originalKLines,
      totalMergeK: summary.mergedKLines,
      mergeRatio: summary.mergeRatio,
      dataBreakdown: `2024: ${metadata.dataRange.breakdown[2024]} days, 2025: ${metadata.dataRange.breakdown[2025]} days`,
    },
    biStats: {
      total: summary.totalBis,
      complete: summary.completeBis,
      uncomplete: summary.uncompleteBis,
      up: summary.upBis,
      down: summary.downBis,
      avgDuration: biStatistics.averageDuration,
      maxDuration: biStatistics.maxDuration,
      minDuration: biStatistics.minDuration,
    },
    channelStats: {
      total: summary.totalChannels,
      complete: summary.completeChannels,
      uncomplete: summary.uncompleteChannels,
      channels: channelDetails,
    },
  };
}

/**
 * Main transform function: Convert backend test results to frontend format
 */
export function transformChanTestData(
  backendResults: BackendChanTestResults
): FrontendChanTestData {
  return {
    kLines: backendResults.data.originalKLines.map(transformKLine),
    mergeK: backendResults.data.mergedKLines.map((mk) => ({
      ...mk,
      startTime: new Date(mk.startTime),
      endTime: new Date(mk.endTime),
      mergedData: mk.mergedData.map(transformKLine),
    })),
    bis: backendResults.data.bis.map(transformBi),
    channels: backendResults.data.channels.map(transformChannel),
    statistics: extractStatistics(backendResults),
  };
}
