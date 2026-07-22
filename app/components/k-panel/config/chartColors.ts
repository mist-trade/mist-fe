import { BiType, BiStatus, ChannelType, TrendDirection } from "@/app/api/types";
import type { BiStyle } from "../types";
import {
  LIGHT_TOKENS,
  DARK_TOKENS,
  type ThemeName,
} from "@/app/styles/tokens";

/**
 * 当前主题的颜色集合。供渲染层（useChartConfig / useChartRender）使用，
 * 取代原先散落的裸 hex 常量。
 */
export interface ThemeChartColors {
  up: string;
  down: string;
  upFill: string;
  downFill: string;
  biValid: string;
  biInvalid: string;
  biUnknown: string;
  fenxingTop: string;
  fenxingBottom: string;
  zhongshuComplete: string;
  zhongshuUncomplete: string;
  /** 分型标记描边色（顶/底分型 path/circle 的 stroke）。随主题用 surface 色保证对比。 */
  fenxingStroke: string;
}

/** 按主题返回图表色集合，取自设计 Token（与 themes.css / antd 同源）。 */
export function getThemeColors(themeName: ThemeName): ThemeChartColors {
  const t = themeName === "dark" ? DARK_TOKENS : LIGHT_TOKENS;
  return {
    up: t.semUp,
    down: t.semDown,
    upFill: hexToRgba(t.semUp, 0.1),
    downFill: hexToRgba(t.semDown, 0.1),
    biValid: t.chanBiValid,
    biInvalid: t.chanBiInvalid,
    biUnknown: t.chanBiUnknown,
    fenxingTop: t.chanFenxingTop,
    fenxingBottom: t.chanFenxingBottom,
    zhongshuComplete: t.chanZhongshuComplete,
    zhongshuUncomplete: t.chanZhongshuUncomplete,
    fenxingStroke: t.surfaceRaised,
  };
}

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

/**
 * 按主题返回笔（bi）颜色。
 * 推荐：渲染层用此版本，传入 getThemeColors(themeName)。
 */
export function getBiColorForTheme(
  type: BiType,
  status: BiStatus | undefined,
  c: ThemeChartColors
): string {
  if (status !== undefined) {
    switch (status) {
      case BiStatus.Valid:
        return c.biValid;
      case BiStatus.Invalid:
        return c.biInvalid;
      case BiStatus.Unknown:
      default:
        return c.biUnknown;
    }
  }
  switch (type) {
    case BiType.UnComplete:
      return c.biUnknown;
    case BiType.Complete:
      return c.biValid;
    default:
      return "#666";
  }
}

// 根据 BiType 获取颜色（作为后备）
// @deprecated 使用 getBiColorForTheme 以支持深色模式；此版本恒为浅色。
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
// @deprecated 渲染层改用 getThemeColors(themeName) 以支持深色模式。此对象恒为浅色。
export const COLORS = {
  up: "#ef5350",
  down: "#26a69a",
  upFill: "rgba(239, 83, 80, 0.1)",
  downFill: "rgba(38, 166, 154, 0.1)",
} as const;

// @deprecated 使用 getThemeColors(themeName).fenxingTop/Bottom。
export const FENXING_COLORS = {
  top: "#2196f3",
  bottom: "#ff9800",
} as const;

/**
 * 按主题返回中枢（channel）颜色。
 */
export function getChannelColorForTheme(
  type: ChannelType,
  c: ThemeChartColors
): string {
  switch (type) {
    case ChannelType.Complete:
      return c.zhongshuComplete;
    case ChannelType.UnComplete:
      return c.zhongshuUncomplete;
    default:
      return "#666";
  }
}

// 根据 ChannelType 获取颜色
// @deprecated 使用 getChannelColorForTheme。此版本恒为浅色。
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
  const r = Number.parseInt(cleanHex.substring(0, 2), 16);
  const g = Number.parseInt(cleanHex.substring(2, 4), 16);
  const b = Number.parseInt(cleanHex.substring(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};
