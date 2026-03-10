import type {
  IFenxing,
  IFetchBi,
  IFetchChannel,
  IFetchK,
  IMergeK,
} from "@/app/api/fetch";
import { FenxingType, TrendDirection } from "@/app/api/fetch";
import type {
  BiMappedData,
  ChannelMappedData,
  FenxingMappedData,
  MergeKRect,
} from "../types";

// 计算合并K线矩形的数据
export const calculateMergeKRects = (
  k: IFetchK[],
  mergeK: IMergeK[]
): MergeKRect[] => {
  if (k.length === 0 || mergeK.length === 0) return [];

  const mergeKRects: MergeKRect[] = [];

  mergeK.forEach((merge, index) => {
    const startTime = new Date(merge.startTime);
    const endTime = new Date(merge.endTime);

    const startIndex = k.findIndex((item) => {
      const kTime = new Date(item.time);
      return kTime.getTime() === startTime.getTime();
    });

    const endIndex = k.findIndex((item) => {
      const kTime = new Date(item.time);
      return kTime.getTime() === endTime.getTime();
    });

    if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
      mergeKRects.push({
        startIndex,
        endIndex,
        highest: merge.highest,
        lowest: merge.lowest,
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

  bi.forEach((b, index) => {
    const startTime = new Date(b.startTime);
    const endTime = new Date(b.endTime);

    const startIndex = k.findIndex((item) => {
      const kTime = new Date(item.time);
      return kTime.getTime() === startTime.getTime();
    });

    const endIndex = k.findIndex((item) => {
      const kTime = new Date(item.time);
      return kTime.getTime() === endTime.getTime();
    });

    if (startIndex === -1 || endIndex === -1) {
      return; // 找不到匹配时跳过这笔数据
    }

    // 直接使用后端返回的最高最低点，不重新计算
    // 后端已经计算好了笔的数据，前端只需要映射到K线图上
    let startPrice: number;
    let endPrice: number;

    if (b.trend === TrendDirection.Up) {
      // 上升笔：从最低点 到 最高点
      startPrice = b.lowest;
      endPrice = b.highest;
    } else {
      // 下降笔：从最高点 到 最低点
      startPrice = b.highest;
      endPrice = b.lowest;
    }

    console.log(`Bi ${index}:`, {
      trend: b.trend,
      startTime: b.startTime,
      endTime: b.endTime,
      startPrice,
      endPrice,
      highest: b.highest,
      lowest: b.lowest,
    });

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
      highest: b.highest,
      lowest: b.lowest,
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

    // 如果笔的K线数量是偶数，使用较小的中间索引（你的建议：偶数就index-1）
    if ((biItem.endIndex - biItem.startIndex + 1) % 2 === 0) {
      // 已经使用Math.floor，所以会自动向下取整，对于偶数来说就是较小的中间索引
    }

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

  channels.forEach((channel, index) => {
    // 使用 startId/endId 查找 K 线索引
    const startIndex = k.findIndex((item) => item.id === channel.startId);
    const endIndex = k.findIndex((item) => item.id === channel.endId);

    // 验证索引有效性
    if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
      console.warn(
        `Invalid channel indices: ${startIndex}-${endIndex}, channel startId: ${channel.startId}, endId: ${channel.endId}`
      );
      return;
    }

    // 查找对应的 Bi 数据
    const channelBiData = channel.bis
      .map((apiBi) => {
        const startTime = new Date(apiBi.startTime);
        const endTime = new Date(apiBi.endTime);

        return biMappedData.find((bi) => {
          const biStartTime = k[bi.startIndex]?.time;
          const biEndTime = k[bi.endIndex]?.time;
          return (
            biStartTime &&
            biEndTime &&
            new Date(biStartTime).getTime() === startTime.getTime() &&
            new Date(biEndTime).getTime() === endTime.getTime()
          );
        });
      })
      .filter((bi): bi is BiMappedData => bi !== undefined);

    channelData.push({
      channelId: index,
      startIndex,
      endIndex,
      zg: channel.zg,
      zd: channel.zd,
      gg: channel.gg,
      dd: channel.dd,
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
  bi?: IFetchBi[]
): FenxingMappedData[] => {
  const fenxings: FenxingMappedData[] = [];

  // 收集所有被笔使用的分型的原始K索引
  const usedFenxingOriginIndices = new Set<number>();
  if (bi && bi.length > 0) {
    bi.forEach((b) => {
      // 使用middleIds的第一个ID来标记已使用的分型
      if (b.startFenxing?.middleIds && b.startFenxing.middleIds.length > 0) {
        usedFenxingOriginIndices.add(b.startFenxing.middleIds[0]);
      }
      if (b.endFenxing?.middleIds && b.endFenxing.middleIds.length > 0) {
        usedFenxingOriginIndices.add(b.endFenxing.middleIds[0]);
      }
    });
  }

  // 使用后端返回的分型数据
  fenxingsFromBackend.forEach((fenxing) => {
    if (!fenxing.middleIds || fenxing.middleIds.length === 0) {
      return;
    }

    // const firstOriginId = fenxing.middleIds[0];
    // 如果这个分型已经被笔使用了，跳过
    // if (usedFenxingOriginIndices.has(firstOriginId)) {
    //   return;
    // }

    // 找到分型价格对应的原始K线
    // 顶分型：找到包含highest的K线
    // 底分型：找到包含lowest的K线
    const targetPrice =
      fenxing.type === "top" ? fenxing.highest : fenxing.lowest;
    let targetOriginId = fenxing.middleIds[0]; // 默认使用第一个

    // 在middleIds中找到包含目标价格的K线
    for (const id of fenxing.middleIds) {
      const kItem = k.find((k) => k.id === id);
      if (kItem) {
        if (fenxing.type === "top" && kItem.highest === targetPrice) {
          targetOriginId = id;
          break;
        }
        if (fenxing.type === "bottom" && kItem.lowest === targetPrice) {
          targetOriginId = id;
          break;
        }
      }
    }

    // 找到目标K线在原始K数组中的索引
    const originKIndex = k.findIndex((item) => item.id === targetOriginId);

    if (originKIndex !== -1) {
      const now = k[originKIndex];
      const fenxingType =
        fenxing.type === "top"
          ? ("top" as FenxingType)
          : ("bottom" as FenxingType);
      const price = targetPrice;

      fenxings.push({
        index: originKIndex, // 使用包含分型价格的原始K索引
        type: fenxingType,
        date: toISODateString(now.time),
        price: price,
        highest: fenxing.highest,
        lowest: fenxing.lowest,
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
