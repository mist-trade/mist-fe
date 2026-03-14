import {
  fetchBi,
  fetchChannel,
  fetchFenxing,
  fetchMergeK,
  IFetchK,
} from "@/app/api/fetch";
import { TestStatistics } from "@/app/api/types/test-statistics.types";
import { shanghaiindex20242025results } from "@/test-data/results/types";
import ErrorBoundary from "@/app/components/ErrorBoundary";
import KPanel from "@/app/components/k-panel";
import KPanelSkeleton from "@/app/components/k-panel/skeleton";
import TestStatisticsPanel from "@/app/components/test-statistics-panel";
import { Suspense } from "react";

// Use mock K-line data, but calculate merge-k, fenxing, bi, channel via backend API
const USE_MOCK_KLINE = true;

async function fetchData() {
  let k: IFetchK[];
  let statistics: TestStatistics | null = null;

  if (USE_MOCK_KLINE) {
    // Use mock K-line data from test results
    k = shanghaiindex20242025results.data.originalKLines;

    // Manually construct TestStatistics from raw data
    const rawData = shanghaiindex20242025results; // Use available data structure
    statistics = {
      metadata: {
        testName: rawData.metadata.testName,
        timestamp: rawData.metadata.timestamp,
        dataSource: rawData.metadata.datasetName,
        dateRange: '2024-2025',
      },
      marketStats: {
        highest: 0,
        lowest: 0,
        yearStart2024: 0,
        yearEnd2024: 0,
        yearReturn2024: 0,
      },
      dataStats: {
        totalKLines: rawData.summary.totalKLines,
        totalMergeK: rawData.summary.totalMergeK,
        mergeRatio: 0,
        dataBreakdown: 'See summary',
      },
      biStats: {
        total: rawData.summary.totalBi,
        complete: 0,
        uncomplete: 0,
        up: 0,
        down: 0,
        avgDuration: 0,
        maxDuration: 0,
        minDuration: 0,
      },
      channelStats: {
        total: rawData.summary.totalChannels,
        complete: 0,
        uncomplete: 0,
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
