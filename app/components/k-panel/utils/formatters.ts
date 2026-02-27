import type { IFetchK } from "@/app/api/fetch";

// 格式化日期显示
export const formatKDate = (time: Date): string => {
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
  params: Array<{ dataIndex: number }>,
  k: IFetchK[],
  dates: string[]
): string => {
  const dataIndex = params[0].dataIndex;
  const item = k[dataIndex];
  return [
    `日期: ${dates[dataIndex]}`,
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
  const prices = k.flatMap((item) => [
    item.highest,
    item.lowest,
    item.open,
    item.close,
  ]);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice;

  return { min: minPrice, max: maxPrice, range: priceRange };
};
