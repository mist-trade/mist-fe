import type {
  IFenxing,
  IFetchBi,
  IFetchChannel,
  IFetchK,
  IMergeK,
} from "@/app/api/fetch";
import { useEffect, useState } from "react";
import type {
  BiMappedData,
  ChannelMappedData,
  FenxingMappedData,
  MergeKRect,
} from "../types";
import {
  calculateBiData,
  calculateChannelData,
  calculateFenxingData,
  calculateMergeKRects,
  createBiPlaceholders,
  createChannelPlaceholders,
  createFenxingPlaceholders,
  createMergeKPlaceholders,
} from "../utils/dataProcessor";

interface ChartData {
  mergeKRects: MergeKRect[];
  biData: BiMappedData[];
  mergeKPlaceholders: Array<number | null>;
  biPlaceholders: Array<number | null>;
  channelData: ChannelMappedData[];
  channelPlaceholders: Array<number | null>;
  fenxingData: FenxingMappedData[];
  fenxingPlaceholders: Array<number | null>;
}

interface UseChartDataResult {
  data: ChartData | null;
  isReady: boolean;
}

export function useChartData(
  k: IFetchK[],
  mergeK: Promise<IMergeK[]>,
  bi: Promise<IFetchBi[]>,
  fenxing: Promise<IFenxing[]>,
  channel: Promise<IFetchChannel[]>
): UseChartDataResult {
  const [data, setData] = useState<ChartData | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const processData = async () => {
      const mergeKData = await mergeK;
      const biData = await bi;
      const fenxingData = await fenxing;
      const channelData = await channel;


      console.log("bi", biData);
      // 详细打印每条笔的数据，特别是 type 字段
      biData.forEach((b, index) => {
        console.log(`Bi ${index}:`, {
          startTime: b.startTime,
          endTime: b.endTime,
          trend: b.trend,
          type: b.type,
        highest: b.highest,
          lowest: b.lowest,
        });
      });

      const mergeKRects = calculateMergeKRects(k, mergeKData);
      const biMappedData = calculateBiData(k, biData);
      const mergeKPlaceholders = createMergeKPlaceholders(
        mergeKRects,
        k.length
      );
      const biPlaceholders = createBiPlaceholders(biMappedData, k.length);

      // 计算分型数据（使用后端返回的分型数据，过滤掉已被笔使用的分型）
      const fenxingMappedData = calculateFenxingData(k, fenxingData, biData);
      const fenxingPlaceholders = createFenxingPlaceholders(
        fenxingMappedData,
        k.length
      );

      // 处理中枢数据
      const channelsMapped = calculateChannelData(k, channelData, biMappedData);
      const channelPlaceholders = createChannelPlaceholders(
        channelsMapped,
        k.length
      );

      setData({
        mergeKRects,
        biData: biMappedData,
        mergeKPlaceholders,
        biPlaceholders,
        channelData: channelsMapped,
        channelPlaceholders,
        fenxingData: fenxingMappedData,
        fenxingPlaceholders,
      });
      setIsReady(true);
    };

    processData();
  }, [k, mergeK, bi, fenxing, channel]);

  return { data, isReady };
}
