import type { IFetchK } from "@/app/api/types";

export interface KTooltipParam {
  dataIndex: number;
}

export const isKTooltipParams = (params: unknown): params is KTooltipParam[] =>
  Array.isArray(params) &&
  params.every(
    (param) =>
      typeof param === "object" &&
      param !== null &&
      typeof (param as { dataIndex?: unknown }).dataIndex === "number"
  );

// 格式化日期显示
export const formatKDate = (time: Date | string): string => {
  const date = new Date(time);
  return `${date.getMonth() + 1}/${date.getDate()}`;
};

// 格式化 K 线数据为 Kline 格式
export const formatKlineData = (k: IFetchK[]): number[][] => {
  return k.map((item) => [item.open, item.close, item.lowest, item.highest]);
};

// 格式化成交量数据
export const formatVolumeData = (k: IFetchK[]): number[] => {
  return k.map((item) => item.amount);
};

// 格式化日期数组
export const formatDateArray = (k: IFetchK[]): string[] => {
  return k.map((item) => formatKDate(item.time));
};

// 格式化 Tooltip 内容
export const formatKTooltip = (
  params: KTooltipParam[],
  k: IFetchK[],
  dates: string[]
): string => {
  const dataIndex = params[0]?.dataIndex;
  if (dataIndex === undefined || dataIndex < 0 || dataIndex >= k.length) {
    return "";
  }
  const item = k[dataIndex];
  if (!item) {
    return "";
  }
  return [
    `日期: ${dates[dataIndex] ?? ""}`,
    `开盘: ${item.open}`,
    `收盘: ${item.close}`,
    `最低: ${item.lowest}`,
    `最高: ${item.highest}`,
    `成交量: ${item.amount}`,
  ].join("<br/>");
};

// 计算价格范围
export const calculatePriceRange = (
  k: IFetchK[]
): { min: number; max: number; range: number } => {
  if (k.length === 0) {
    return { min: 0, max: 0, range: 0 };
  }

  let minPrice = Number.POSITIVE_INFINITY;
  let maxPrice = Number.NEGATIVE_INFINITY;
  k.forEach((item) => {
    minPrice = Math.min(minPrice, item.highest, item.lowest, item.open, item.close);
    maxPrice = Math.max(maxPrice, item.highest, item.lowest, item.open, item.close);
  });
  const priceRange = maxPrice - minPrice;

  return { min: minPrice, max: maxPrice, range: priceRange };
};
