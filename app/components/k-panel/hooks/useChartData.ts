import type {
  IFenxing,
  IFetchBi,
  IFetchChannel,
  IFetchDuan,
  IFetchDuanChannel,
  IFetchK,
  IMergeK,
} from "@/app/api/types";
import { useEffect, useState } from "react";
import type {
  BiMappedData,
  BspSignalMappedData,
  BspSignalSourceData,
  ChannelMappedData,
  DuanChannelMappedData,
  DuanMappedData,
  FenxingMappedData,
  MacdData,
  MergeKRect,
} from "../types";
import {
  calculateBiData,
  calculateBspData,
  calculateChannelData,
  calculateDuanChannelData,
  calculateDuanData,
  calculateFenxingData,
  calculateMacd,
  calculateMergeKRects,
  createBiPlaceholders,
  createBspPlaceholders,
  createChannelPlaceholders,
  createDuanChannelPlaceholders,
  createDuanPlaceholders,
  createFenxingPlaceholders,
  createMergeKPlaceholders,
} from "../utils/dataProcessor";

export interface ChartData {
  mergeKRects: MergeKRect[];
  biData: BiMappedData[];
  mergeKPlaceholders: Array<number | null>;
  biPlaceholders: Array<number | null>;
  channelData: ChannelMappedData[];
  channelPlaceholders: Array<number | null>;
  fenxingData: FenxingMappedData[];
  fenxingPlaceholders: Array<number | null>;
  duanData: DuanMappedData[];
  duanPlaceholders: Array<number | null>;
  duanChannelData: DuanChannelMappedData[];
  duanChannelPlaceholders: Array<number | null>;
  bspData: BspSignalMappedData[];
  bspPlaceholders: Array<number | null>;
  macdData: MacdData;
}

export interface UseChartDataResult {
  data: ChartData | null;
  isReady: boolean;
}

export function useChartData(
  k: IFetchK[],
  mergeK: Promise<IMergeK[]>,
  bi: Promise<IFetchBi[]>,
  fenxing: Promise<IFenxing[]>,
  channel: Promise<IFetchChannel[]>,
  duan?: Promise<IFetchDuan[]>,
  duanChannel?: Promise<IFetchDuanChannel[]>,
  signals?: Promise<BspSignalSourceData[]> | BspSignalSourceData[]
): UseChartDataResult {
  const [data, setData] = useState<ChartData | null>(null);

  useEffect(() => {
    let active = true;

    const processData = async () => {
      const mergeKData = await mergeK;
      const biData = await bi;
      const fenxingData = await fenxing;
      const channelData = await channel;
      const duanDataRaw = duan ? await duan : undefined;
      const duanChannelDataRaw = duanChannel ? await duanChannel : undefined;
      const signalsRaw = signals ? await signals : undefined;

      if (!active) return;

      const mergeKRects = calculateMergeKRects(k, mergeKData);
      const biMappedData = calculateBiData(k, biData);
      const mergeKPlaceholders = createMergeKPlaceholders(
        mergeKRects,
        k.length
      );
      const biPlaceholders = createBiPlaceholders(biMappedData, k.length);

      // 计算分型数据
      const fenxingMappedData = calculateFenxingData(k, fenxingData, biData);
      const fenxingPlaceholders = createFenxingPlaceholders(
        fenxingMappedData,
        k.length
      );

      // 处理笔中枢数据
      const channelsMapped = calculateChannelData(k, channelData, biMappedData);
      const channelPlaceholders = createChannelPlaceholders(
        channelsMapped,
        k.length
      );

      // 处理线段数据
      const duanMappedData = calculateDuanData(k, duanDataRaw);
      const duanPlaceholders = createDuanPlaceholders(
        duanMappedData,
        k.length
      );

      // 处理段中枢数据
      const duanChannelsMapped = calculateDuanChannelData(
        k,
        duanChannelDataRaw
      );
      const duanChannelPlaceholders = createDuanChannelPlaceholders(
        duanChannelsMapped,
        k.length
      );

      // 处理买卖点数据
      const bspMappedData = calculateBspData(k, signalsRaw);
      const bspPlaceholders = createBspPlaceholders(bspMappedData, k.length);

      // 计算 MACD
      const macdData = calculateMacd(k);

      setData({
        mergeKRects,
        biData: biMappedData,
        mergeKPlaceholders,
        biPlaceholders,
        channelData: channelsMapped,
        channelPlaceholders,
        fenxingData: fenxingMappedData,
        fenxingPlaceholders,
        duanData: duanMappedData,
        duanPlaceholders,
        duanChannelData: duanChannelsMapped,
        duanChannelPlaceholders,
        bspData: bspMappedData,
        bspPlaceholders,
        macdData,
      });
    };

    processData();
    return () => {
      active = false;
    };
  }, [k, mergeK, bi, fenxing, channel, duan, duanChannel, signals]);

  return { data, isReady: data !== null };
}

