import { BiType, ChannelType, TrendDirection } from "@/app/api/fetch";
import type { BiStyle } from "../types";

// 根据 BiType 获取颜色
export const getBiColor = (type: BiType): string => {
  switch (type) {
    case BiType.Initial: // 初始笔
      return "#ff9800"; // 橙色
    case BiType.UnComplete: // 未完成笔
      return "#9c27b0"; // 紫色
    case BiType.Complete: // 完成笔
      return "#2196f3"; // 蓝色
    default:
      return "#666"; // 默认灰色
  }
};

// 根据 TrendDirection 获取样式
export const getBiStyle = (trend: TrendDirection): BiStyle => {
  switch (trend) {
    case TrendDirection.Up:
      return {
        lineWidth: 2,
        lineDash: [], // 实线
        opacity: 1,
      };
    case TrendDirection.Down:
      return {
        lineWidth: 2,
        lineDash: [5, 3], // 虚线
        opacity: 1,
      };
    case TrendDirection.None:
      return {
        lineWidth: 1,
        lineDash: [2, 2], // 点线
        opacity: 0.6,
      };
    default:
      return {
        lineWidth: 2,
        lineDash: [],
        opacity: 1,
      };
  }
};

// Color scheme constants
export const COLORS = {
  up: "#ef5350",
  down: "#26a69a",
  upFill: "rgba(239, 83, 80, 0.1)",
  downFill: "rgba(38, 166, 154, 0.1)",
} as const;

// 根据 ChannelType 获取颜色
export const getChannelColor = (type: ChannelType): string => {
  switch (type) {
    case ChannelType.Complete:
      return "#4caf50"; // 绿色
    case ChannelType.UnComplete:
      return "#ff9800"; // 橙色
    default:
      return "#666"; // 默认灰色
  }
};

// 将 hex 颜色转换为 rgba
export const hexToRgba = (hex: string, alpha: number): string => {
  // 移除 # 前缀
  const cleanHex = hex.replace("#", "");

  // 解析 RGB 值
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};
