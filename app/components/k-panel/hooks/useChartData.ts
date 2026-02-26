import { useEffect, useState } from "react";
import type { IFetchBi, IFetchChannel, IFetchK, IMergeK } from "@/app/api/fetch";
import type { BiMappedData, ChannelMappedData, MergeKRect } from "../types";
import {
  calculateBiData,
  calculateMergeKRects,
  calculateChannelData,
  createBiPlaceholders,
  createMergeKPlaceholders,
  createChannelPlaceholders,
} from "../utils/dataProcessor";

interface ChartData {
  mergeKRects: MergeKRect[];
  biData: BiMappedData[];
  mergeKPlaceholders: Array<number | null>;
  biPlaceholders: Array<number | null>;
  channelData: ChannelMappedData[];
  channelPlaceholders: Array<number | null>;
}

interface UseChartDataResult {
  data: ChartData | null;
  isReady: boolean;
}

export function useChartData(
  k: IFetchK[],
  mergeK: Promise<IMergeK[]>,
  bi: Promise<IFetchBi[]>,
  channel: Promise<IFetchChannel[]>
): UseChartDataResult {
  const [data, setData] = useState<ChartData | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const processData = async () => {
      const mergeKData = await mergeK;
      const biData = await bi;
      const channelData = await channel;

      const mergeKRects = calculateMergeKRects(k, mergeKData);
      const biMappedData = calculateBiData(k, biData);
      const mergeKPlaceholders = createMergeKPlaceholders(mergeKRects, k.length);
      const biPlaceholders = createBiPlaceholders(biMappedData, k.length);

      // 处理中枢数据
      const channelsMapped = calculateChannelData(k, channelData, biMappedData);
      const channelPlaceholders = createChannelPlaceholders(channelsMapped, k.length);

      setData({
        mergeKRects,
        biData: biMappedData,
        mergeKPlaceholders,
        biPlaceholders,
        channelData: channelsMapped,
        channelPlaceholders,
      });
      setIsReady(true);
    };

    processData();
  }, [k, mergeK, bi, channel]);

  return { data, isReady };
}
