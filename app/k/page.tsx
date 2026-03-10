import {
  fetchBi,
  fetchChannel,
  fetchFenxing,
  fetchMergeK,
} from "@/app/api/fetch";
import { shanghaiindex20242025results } from "@/test-data/results/types";
import ErrorBoundary from "@/app/components/ErrorBoundary";
import KPanel from "@/app/components/k-panel";
import KPanelSkeleton from "@/app/components/k-panel/skeleton";
import TestStatisticsPanel from "@/app/components/test-statistics-panel";
import { Suspense } from "react";

// Use mock K-line data, but calculate merge-k, fenxing, bi, channel via backend API
const USE_MOCK_KLINE = true;

async function fetchData() {
  let k: any[];
  let statistics: any;

  if (USE_MOCK_KLINE) {
    // Use mock K-line data from test results
    k = shanghaiindex20242025results.data.originalKLines;

    // Manually construct TestStatistics from raw data
    const rawData = shanghaiindex20242025results as any; // Access full backend data
    statistics = {
      metadata: {
        testName: rawData.metadata.testName,
        timestamp: rawData.metadata.timestamp,
        dataSource: rawData.metadata.dataSource,
        dateRange: `${rawData.metadata.dataRange.start} to ${rawData.metadata.dataRange.end}`,
      },
      marketStats: rawData.metadata.marketStats,
      dataStats: {
        totalKLines: rawData.summary.originalKLines,
        totalMergeK: rawData.summary.mergedKLines,
        mergeRatio: rawData.summary.mergeRatio,
        dataBreakdown: `2024: ${rawData.metadata.dataRange.breakdown[2024]} days, 2025: ${rawData.metadata.dataRange.breakdown[2025]} days`,
      },
      biStats: {
        total: rawData.summary.totalBis,
        complete: rawData.summary.completeBis,
        uncomplete: rawData.summary.uncompleteBis,
        up: rawData.summary.upBis,
        down: rawData.summary.downBis,
        avgDuration: rawData.biStatistics.averageDuration,
        maxDuration: rawData.biStatistics.maxDuration,
        minDuration: rawData.biStatistics.minDuration,
      },
      channelStats: {
        total: rawData.summary.totalChannels,
        complete: rawData.summary.completeChannels,
        uncomplete: rawData.summary.uncompleteChannels,
        channels: [], // Channel details would require parsing from rawData.data.channels
      },
    };
  } else {
    // Fetch from backend API (requires mist service with database)
    // Not implemented yet
    throw new Error("Live API fetch not implemented");
  }

  // Calculate merge-k, fenxing, bi, channel via backend Chan API
  const mergeK = fetchMergeK(k);
  const bi = fetchBi(k);
  const fenxing = fetchFenxing(k);
  const channel = bi.then((biData) => fetchChannel(biData)); // Channel 依赖 Bi

  return {
    k,
    mergeK,
    bi,
    fenxing,
    channel,
    statistics,
  };
}

export default async function K() {
  const { k, mergeK, bi, fenxing, channel, statistics } = await fetchData();

  return (
    <ErrorBoundary>
      <Suspense fallback={<KPanelSkeleton />}>
        <KPanel
          k={k}
          mergeK={mergeK}
          bi={bi}
          fenxing={fenxing}
          channel={channel}
        />
        {statistics && <TestStatisticsPanel statistics={statistics} />}
      </Suspense>
    </ErrorBoundary>
  );
}
