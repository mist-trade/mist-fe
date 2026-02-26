import { fetchK, fetchMergeK, fetchBi, fetchChannel } from "@/app/api/fetch";
import KPanel from "@/app/components/k-panel";
import KPanelSkeleton from "@/app/components/k-panel/skeleton";
import ErrorBoundary from "@/app/components/ErrorBoundary";
import { Suspense } from "react";

async function fetchData() {
  const k = await fetchK({
    symbol: "000300",
    code: "sh",
    startDate: "2024-09-23",
    endDate: "2025-02-21",
  });

  const mergeK = fetchMergeK(k);
  const bi = fetchBi(k);
  const channel = bi.then((biData) => fetchChannel(biData)); // Channel 依赖 Bi

  return { k, mergeK, bi, channel };
}

export default async function K() {
  const { k, mergeK, bi, channel } = await fetchData();

  return (
    <ErrorBoundary>
      <Suspense fallback={<KPanelSkeleton />}>
        <KPanel k={k} mergeK={mergeK} bi={bi} channel={channel} />
      </Suspense>
    </ErrorBoundary>
  );
}
