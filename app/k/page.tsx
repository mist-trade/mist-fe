import {
  fetchBi,
  fetchChannel,
  fetchFenxing,
  fetchMergeK,
} from "@/app/api/fetch";
import { shanghaiIndex2024_2025Results } from "@/test-data/results/types";
import ErrorBoundary from "@/app/components/ErrorBoundary";
import KPanel from "@/app/components/k-panel";
import KPanelSkeleton from "@/app/components/k-panel/skeleton";
import { Suspense } from "react";

// Use mock K-line data, but calculate merge-k, fenxing, bi, channel via backend API
const USE_MOCK_KLINE = true;

async function fetchData() {
  let k: any[];

  if (USE_MOCK_KLINE) {
    // Use mock K-line data from test results
    k = shanghaiIndex2024_2025Results.data.originalKLines;
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
    statistics: USE_MOCK_KLINE
      ? shanghaiIndex2024_2025Results.summary
      : undefined,
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
      </Suspense>
    </ErrorBoundary>
  );
}
