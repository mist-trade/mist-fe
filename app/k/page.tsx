import { fetchK, fetchMergeK, fetchBi } from "@/app/api/fetch";
import KPanel from "@/app/components/k-panel";
import KPanelSkeleton from "@/app/components/k-panel/skeleton";
import { Suspense } from "react";

export default async function K() {
  const k = await fetchK({
    symbol: "000300",
    code: "sh",
    startDate: "2024-09-23",
    endDate: "2025-02-21",
  });

  const mergeK = fetchMergeK(k);
  const bi = fetchBi(k);

  return (
    <Suspense fallback={<KPanelSkeleton />}>
      <KPanel k={k} mergeK={mergeK} bi={bi} />
    </Suspense>
  );
}
