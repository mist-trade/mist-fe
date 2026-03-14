import { BiType, BiStatus, ChannelType, TrendDirection } from "@/app/api/fetch";
import type { BiStyle } from "../types";

// 根据 BiStatus 获取颜色（优先级更高）
const getBiColorByStatus = (status: BiStatus): string => {
  switch (status) {
    case BiStatus.Valid:
      return "#00bcd4";   // 青色 - 有效笔（清新醒目）
    case BiStatus.Invalid:
      return "#ec407a";   // 粉红色 - 无效笔（柔和但明显）
    case BiStatus.Unknown:
    default:
      return "#ff9800";   // 橙色 - 未知状态（醒目标记）
  }
};

// 根据 BiType 获取颜色（作为后备）
export const getBiColor = (type: BiType, status?: BiStatus): string => {
  // 如果提供了 status，优先使用状态颜色
  if (status !== undefined) {
    return getBiColorByStatus(status);
  }

  // 否则回退到原有逻辑（使用清新配色方案保持一致）
  switch (type) {
    case BiType.UnComplete: // 未完成笔
      return "#ff9800"; // 橙色（与Unknown保持一致）
    case BiType.Complete: // 完成笔
      return "#00bcd4"; // 青色（与Valid保持一致）
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
        lineDash: [], // 实线
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
      return "#00e676"; // 亮绿色 - 更高饱和度和亮度，适合夜间模式
    case ChannelType.UnComplete:
      return "#ffab00"; // 亮橙色 - 温暖醒目，夜间模式对比度高
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
