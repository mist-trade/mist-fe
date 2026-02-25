import { TrendDirection } from "@/app/api/fetch";
import type { IFetchBi, IFetchK, IMergeK } from "@/app/api/fetch";
import type { BiMappedData, MergeKRect } from "../types";

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
export const calculateBiData = (k: IFetchK[], bi: IFetchBi[]): BiMappedData[] => {
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
      return null;
    }

    biData.push({
      startIndex,
      endIndex,
      startPrice: b.trend === TrendDirection.Up ? b.lowest : b.highest,
      endPrice: b.trend === TrendDirection.Up ? b.highest : b.lowest,
      trend: b.trend,
      type: b.type,
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
