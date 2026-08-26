import type {
  FenxingType,
  IFenxing,
  IFetchBi,
  IFetchChannel,
  IFetchDuan,
  IFetchDuanChannel,
  IFetchK,
  IMergeK,
} from "@/app/api/types";
import { TrendDirection } from "@/app/api/types";
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

export interface KLineIndexes {
  byTime: Map<number, number>;
  byId: Map<number, number>;
}

const timeKey = (time: Date | string): number => new Date(time).getTime();

export const buildKLineIndexes = (k: IFetchK[]): KLineIndexes => {
  const byTime = new Map<number, number>();
  const byId = new Map<number, number>();

  k.forEach((item, index) => {
    byTime.set(timeKey(item.time), index);
    byId.set(item.id, index);
  });

  return { byTime, byId };
};

// 计算合并K线矩形的数据
export const calculateMergeKRects = (
  k: IFetchK[],
  mergeK: IMergeK[]
): MergeKRect[] => {
  if (k.length === 0 || mergeK.length === 0) return [];

  const mergeKRects: MergeKRect[] = [];
  const indexes = buildKLineIndexes(k);

  mergeK.forEach((merge, index) => {
    const startIndex = indexes.byTime.get(timeKey(merge.startTime)) ?? -1;
    const endIndex = indexes.byTime.get(timeKey(merge.endTime)) ?? -1;

    if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
      mergeKRects.push({
        startIndex,
        endIndex,
        high: merge.high,
        low: merge.low,
        trend: merge.trend,
        rectId: index,
      });
    }
  });

  return mergeKRects;
};

// 计算笔数据
export const calculateBiData = (
  k: IFetchK[],
  bi: IFetchBi[]
): BiMappedData[] => {
  if (k.length === 0 || bi.length === 0) return [];

  const biData: BiMappedData[] = [];
  const indexes = buildKLineIndexes(k);

  bi.forEach((b, index) => {
    const startIndex = indexes.byTime.get(timeKey(b.startTime)) ?? -1;
    const endIndex = indexes.byTime.get(timeKey(b.endTime)) ?? -1;

    if (startIndex === -1 || endIndex === -1) {
      return; // 找不到匹配时跳过这笔数据
    }

    // 直接使用后端返回的最高最低点，不重新计算
    // 后端已经计算好了笔的数据，前端只需要映射到K线图上
    let startPrice: number;
    let endPrice: number;

    if (b.trend === TrendDirection.Up) {
      // 上升笔：从最低点 到 最高点
      startPrice = b.low;
      endPrice = b.high;
    } else {
      // 下降笔：从最高点 到 最低点
      startPrice = b.high;
      endPrice = b.low;
    }

    biData.push({
      startIndex,
      endIndex,
      startPrice,
      endPrice,
      trend: b.trend,
      type: b.type,
      status: b.status,
      independentCount: b.independentCount,
      originData: b.originData,
      high: b.high,
      low: b.low,
      biId: index,
    });
  });

  return biData;
};

// 创建合并K线的占位符数组
export const createMergeKPlaceholders = (
  mergeKRects: MergeKRect[],
  kLength: number
): Array<number | null> => {
  const placeholders: Array<number | null> = new Array(kLength).fill(null);

  // 在每个矩形的开始位置放置矩形ID
  mergeKRects.forEach((rect) => {
    if (rect.startIndex >= 0 && rect.startIndex < placeholders.length) {
      placeholders[rect.startIndex] = rect.rectId;
    }
  });

  return placeholders;
};

// 创建笔的占位符数组（放在中间位置）
export const createBiPlaceholders = (
  biData: BiMappedData[],
  kLength: number
): Array<number | null> => {
  const placeholders: Array<number | null> = new Array(kLength).fill(null);

  // 在每个笔的中间位置放置笔ID
  biData.forEach((biItem) => {
    const midIndex = Math.floor((biItem.startIndex + biItem.endIndex) / 2);

    if (midIndex >= 0 && midIndex < placeholders.length) {
      placeholders[midIndex] = biItem.biId;
    }
  });

  return placeholders;
};

// 计算中枢数据
export const calculateChannelData = (
  k: IFetchK[],
  channels: IFetchChannel[],
  biMappedData: BiMappedData[]
): ChannelMappedData[] => {
  if (k.length === 0 || channels.length === 0) {
    return [];
  }

  const channelData: ChannelMappedData[] = [];
  const indexes = buildKLineIndexes(k);
  const biByTimeRange = new Map<string, BiMappedData>();
  biMappedData.forEach((bi) => {
    const startTime = k[bi.startIndex]?.time;
    const endTime = k[bi.endIndex]?.time;
    if (startTime && endTime) {
      biByTimeRange.set(`${timeKey(startTime)}:${timeKey(endTime)}`, bi);
    }
  });

  channels.forEach((channel, index) => {
    // 使用 displayStartId/displayEndId 查找 K 线索引
    // 如果 display 字段不存在，则回退到 startId/endId
    const startIdToUse = channel.displayStartId ?? channel.startId;
    const endIdToUse = channel.displayEndId ?? channel.endId;

    const startIndex = indexes.byId.get(startIdToUse) ?? -1;
    const endIndex = indexes.byId.get(endIdToUse) ?? -1;

    // 验证索引有效性
    if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
      return;
    }

    // 查找对应的 Bi 数据
    const channelBiData = channel.bis
      .map((apiBi) => {
        return biByTimeRange.get(
          `${timeKey(apiBi.startTime)}:${timeKey(apiBi.endTime)}`
        );
      })
      .filter((bi): bi is BiMappedData => bi !== undefined);

    channelData.push({
      channelId: index,
      startIndex,
      endIndex,
      zg: channel.zg,
      zd: channel.zd,
      trend: channel.trend,
      type: channel.type,
      level: channel.level,
      bis: channelBiData,
    });
  });

  return channelData;
};

// Helper function to safely convert time to ISO date string
const toISODateString = (time: Date | string): string => {
  if (typeof time === "string") {
    return time.split("T")[0];
  }
  return time.toISOString().split("T")[0];
};

// 计算分型数据（使用后端返回的分型数据）
export const calculateFenxingData = (
  k: IFetchK[],
  fenxingsFromBackend: IFenxing[],
  _bi?: IFetchBi[]
): FenxingMappedData[] => {
  void _bi;

  const fenxings: FenxingMappedData[] = [];
  const indexes = buildKLineIndexes(k);

  // 使用后端返回的分型数据
  fenxingsFromBackend.forEach((fenxing) => {
    if (!fenxing.middleIds || fenxing.middleIds.length === 0) {
      return;
    }

    // 找到分型价格对应的原始K线
    // 顶分型：找到包含high的K线
    // 底分型：找到包含low的K线
    const targetPrice =
      fenxing.type === "top" ? fenxing.high : fenxing.low;
    let targetOriginId = fenxing.middleIds[0]; // 默认使用第一个

    // 在middleIds中找到包含目标价格的K线
    for (const id of fenxing.middleIds) {
      const kIndex = indexes.byId.get(id);
      const sourceK = kIndex === undefined ? undefined : k[kIndex];
      if (sourceK) {
        if (fenxing.type === "top" && sourceK.high === targetPrice) {
          targetOriginId = id;
          break;
        }
        if (fenxing.type === "bottom" && sourceK.low === targetPrice) {
          targetOriginId = id;
          break;
        }
      }
    }

    // 找到目标K线在原始K数组中的索引
    const originKIndex = indexes.byId.get(targetOriginId) ?? -1;

    if (originKIndex !== -1) {
      const now = k[originKIndex];
      const fenxingType: FenxingType = fenxing.type;
      const price = targetPrice;

      fenxings.push({
        index: originKIndex, // 使用包含分型价格的原始K索引
        type: fenxingType,
        date: toISODateString(now.time),
        price: price,
        high: fenxing.high,
        low: fenxing.low,
      });
    }
  });

  return fenxings;
};

// 创建分型的占位符数组
export const createFenxingPlaceholders = (
  fenxings: FenxingMappedData[],
  kLength: number
): Array<number | null> => {
  const placeholders: Array<number | null> = new Array(kLength).fill(null);

  fenxings.forEach((fenxing) => {
    if (fenxing.index >= 0 && fenxing.index < placeholders.length) {
      placeholders[fenxing.index] = fenxing.index;
    }
  });

  return placeholders;
};

// 创建中枢的占位符数组
export const createChannelPlaceholders = (
  channelData: ChannelMappedData[],
  kLength: number
): Array<number | null> => {
  const placeholders: Array<number | null> = new Array(kLength).fill(null);

  channelData.forEach((channel) => {
    // 在起始索引位置放置 channelId（与 MergeK 相同的模式）
    if (channel.startIndex >= 0 && channel.startIndex < placeholders.length) {
      placeholders[channel.startIndex] = channel.channelId;
    }
  });

  return placeholders;
};

// 计算线段数据 (Duan)
export const calculateDuanData = (
  k: IFetchK[],
  duans?: IFetchDuan[]
): DuanMappedData[] => {
  if (k.length === 0 || !duans || duans.length === 0) return [];

  const duanData: DuanMappedData[] = [];
  const indexes = buildKLineIndexes(k);

  duans.forEach((d, index) => {
    const startIndex = indexes.byTime.get(timeKey(d.startTime)) ?? -1;
    const endIndex = indexes.byTime.get(timeKey(d.endTime)) ?? -1;

    if (startIndex === -1 || endIndex === -1) {
      return;
    }

    let startPrice: number;
    let endPrice: number;

    if (d.trend === TrendDirection.Up) {
      startPrice = d.low;
      endPrice = d.high;
    } else {
      startPrice = d.high;
      endPrice = d.low;
    }

    duanData.push({
      duanId: index,
      startIndex,
      endIndex,
      startPrice,
      endPrice,
      trend: d.trend,
      type: d.type,
      status: d.status,
      independentCount: d.independentCount,
      high: d.high,
      low: d.low,
    });
  });

  return duanData;
};

// 创建线段的占位符数组（放置在中间索引）
export const createDuanPlaceholders = (
  duanData: DuanMappedData[],
  kLength: number
): Array<number | null> => {
  const placeholders: Array<number | null> = new Array(kLength).fill(null);

  duanData.forEach((duanItem) => {
    const midIndex = Math.floor((duanItem.startIndex + duanItem.endIndex) / 2);
    if (midIndex >= 0 && midIndex < placeholders.length) {
      placeholders[midIndex] = duanItem.duanId;
    }
  });

  return placeholders;
};

// 计算段中枢数据 (DuanChannel)
export const calculateDuanChannelData = (
  k: IFetchK[],
  duanChannels?: IFetchDuanChannel[]
): DuanChannelMappedData[] => {
  if (k.length === 0 || !duanChannels || duanChannels.length === 0) return [];

  const duanChannelData: DuanChannelMappedData[] = [];
  const indexes = buildKLineIndexes(k);

  duanChannels.forEach((dc, index) => {
    const startIdToUse = dc.displayStartId ?? dc.startId;
    const endIdToUse = dc.displayEndId ?? dc.endId;

    let startIndex = indexes.byId.get(startIdToUse) ?? -1;
    let endIndex = indexes.byId.get(endIdToUse) ?? -1;

    if ((startIndex === -1 || endIndex === -1) && dc.duans && dc.duans.length > 0) {
      const first = dc.duans[0];
      const last = dc.duans[dc.duans.length - 1];
      if (first && last) {
        startIndex = indexes.byTime.get(timeKey(first.startTime)) ?? -1;
        endIndex = indexes.byTime.get(timeKey(last.endTime)) ?? -1;
      }
    }

    if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
      return;
    }

    duanChannelData.push({
      channelId: index,
      startIndex,
      endIndex,
      zg: dc.zg,
      zd: dc.zd,
      gg: dc.gg,
      dd: dc.dd,
      type: dc.type,
      level: dc.level,
      expanded: dc.expanded,
    });
  });

  return duanChannelData;
};

// 创建段中枢占位符数组
export const createDuanChannelPlaceholders = (
  duanChannels: DuanChannelMappedData[],
  kLength: number
): Array<number | null> => {
  const placeholders: Array<number | null> = new Array(kLength).fill(null);

  duanChannels.forEach((channel) => {
    if (channel.startIndex >= 0 && channel.startIndex < placeholders.length) {
      placeholders[channel.startIndex] = channel.channelId;
    }
  });

  return placeholders;
};

const BSP_LABEL_MAP: Record<string, string> = {
  first_buy: "1买",
  first_sell: "1卖",
  second_buy: "2买",
  second_sell: "2卖",
  third_buy: "3买",
  third_sell: "3卖",
  entry: "买入",
  exit: "卖出",
};

// 计算买卖点映射数据 (BSP)
export const calculateBspData = (
  k: IFetchK[],
  signals?: BspSignalSourceData[]
): BspSignalMappedData[] => {
  if (k.length === 0 || !signals || signals.length === 0) return [];

  const bspMappedData: BspSignalMappedData[] = [];
  const indexes = buildKLineIndexes(k);

  signals.forEach((sig, index) => {
    const sigTimeMs = timeKey(sig.signalTime);
    let kIndex = indexes.byTime.get(sigTimeMs) ?? -1;

    // 如果未精确匹配，寻找时间最接近且 <= sigTimeMs 的 K 线
    if (kIndex === -1) {
      for (let i = k.length - 1; i >= 0; i--) {
        if (timeKey(k[i].time) <= sigTimeMs) {
          kIndex = i;
          break;
        }
      }
    }

    if (kIndex === -1) return;

    const rawType = String(sig.type || sig.signalKind || "signal");
    const label = BSP_LABEL_MAP[rawType] || (rawType.includes("buy") ? "买点" : rawType.includes("sell") ? "卖点" : "信号");
    const isBuy =
      rawType === "first_buy" ||
      rawType === "second_buy" ||
      rawType === "third_buy" ||
      rawType === "entry" ||
      label.includes("买");

    const price =
      typeof sig.price === "number" && Number.isFinite(sig.price)
        ? sig.price
        : isBuy
        ? k[kIndex].low
        : k[kIndex].high;

    bspMappedData.push({
      bspId: index,
      index: kIndex,
      time: toISODateString(sig.signalTime),
      price,
      type: rawType,
      label,
      isBuy,
      rawSignal: sig,
    });
  });

  return bspMappedData;
};

// 创建买卖点占位符数组
export const createBspPlaceholders = (
  bspData: BspSignalMappedData[],
  kLength: number
): Array<number | null> => {
  const placeholders: Array<number | null> = new Array(kLength).fill(null);

  bspData.forEach((bsp) => {
    if (bsp.index >= 0 && bsp.index < placeholders.length) {
      placeholders[bsp.index] = bsp.bspId;
    }
  });

  return placeholders;
};

// 计算标准 MACD (12, 26, 9) 指标序列
export const calculateMacd = (
  k: IFetchK[],
  shortPeriod = 12,
  longPeriod = 26,
  signalPeriod = 9
): MacdData => {
  if (k.length === 0) {
    return { dif: [], dea: [], hist: [] };
  }

  const dif: Array<number | null> = new Array(k.length).fill(null);
  const dea: Array<number | null> = new Array(k.length).fill(null);
  const hist: Array<number | null> = new Array(k.length).fill(null);

  const k1 = 2 / (shortPeriod + 1);
  const k2 = 2 / (longPeriod + 1);
  const kSig = 2 / (signalPeriod + 1);

  let emaShort = k[0].close;
  let emaLong = k[0].close;
  let emaDea = 0;

  for (let i = 0; i < k.length; i++) {
    const close = k[i].close;
    emaShort = close * k1 + emaShort * (1 - k1);
    emaLong = close * k2 + emaLong * (1 - k2);

    const curDif = emaShort - emaLong;
    dif[i] = Number(curDif.toFixed(4));

    if (i === 0) {
      emaDea = curDif;
    } else {
      emaDea = curDif * kSig + emaDea * (1 - kSig);
    }
    dea[i] = Number(emaDea.toFixed(4));

    const curHist = (curDif - emaDea) * 2;
    hist[i] = Number(curHist.toFixed(4));
  }

  return { dif, dea, hist };
};

