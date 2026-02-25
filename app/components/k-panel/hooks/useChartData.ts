import { useEffect, useState } from "react";
import type { IFetchBi, IFetchK, IMergeK } from "@/app/api/fetch";
import type { BiMappedData, MergeKRect } from "../types";
import {
  calculateBiData,
  calculateMergeKRects,
  createBiPlaceholders,
  createMergeKPlaceholders,
} from "../utils/dataProcessor";

interface ChartData {
  mergeKRects: MergeKRect[];
  biData: BiMappedData[];
  mergeKPlaceholders: Array<number | null>;
  biPlaceholders: Array<number | null>;
}

interface UseChartDataResult {
  data: ChartData | null;
  isReady: boolean;
}

export function useChartData(
  k: IFetchK[],
  mergeK: Promise<IMergeK[]>,
  bi: Promise<IFetchBi[]>
): UseChartDataResult {
  const [data, setData] = useState<ChartData | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const processData = async () => {
      const mergeKData = await mergeK;
      const biData = await bi;

      const mergeKRects = calculateMergeKRects(k, mergeKData);
      const biMappedData = calculateBiData(k, biData);
      const mergeKPlaceholders = createMergeKPlaceholders(mergeKRects, k.length);
      const biPlaceholders = createBiPlaceholders(biMappedData, k.length);

      setData({
        mergeKRects,
        biData: biMappedData,
        mergeKPlaceholders,
        biPlaceholders,
      });
      setIsReady(true);
    };

    processData();
  }, [k, mergeK, bi]);

  return { data, isReady };
}
