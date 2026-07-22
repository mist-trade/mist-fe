import type {
  GridComponentOption,
  LegendComponentOption,
  TitleComponentOption,
  TooltipComponentOption,
  DataZoomComponentOption,
} from "echarts/components";
import {
  LIGHT_TOKENS,
  DARK_TOKENS,
  type ThemeName,
} from "@/app/styles/tokens";

export const K_PANEL_HEIGHT = 600;

// Chart title configuration
export const TITLE_CONFIG: TitleComponentOption = {
  text: "K线图",
  left: 0,
};

// Chart legend configuration
export const LEGEND_CONFIG: LegendComponentOption = {
  data: ["K线", "成交量", "笔", "中枢", "合并K", "分型"],
  top: 30,
};

/**
 * 按主题返回 tooltip 配置（背景/边框/文字色随主题）。
 * 取代原先写死 #ccc/#000 的 TOOLTIP_CONFIG。
 */
export function getTooltipConfig(themeName: ThemeName): TooltipComponentOption {
  const t = themeName === "dark" ? DARK_TOKENS : LIGHT_TOKENS;
  return {
    trigger: "axis",
    axisPointer: {
      type: "cross",
    },
    borderWidth: 1,
    borderColor: t.borderSubtle,
    padding: 10,
    backgroundColor: t.surfaceOverlay,
    textStyle: {
      color: t.textPrimary,
    },
  };
}

/**
 * 按主题返回 axisPointer label 背景色。
 */
export function getAxisPointerLabelBg(themeName: ThemeName): string {
  const t = themeName === "dark" ? DARK_TOKENS : LIGHT_TOKENS;
  return t.borderStrong;
}

// Chart grid configuration
export const GRID_CONFIG: GridComponentOption[] = [
  {
    left: "10%",
    right: "8%",
    height: "50%",
  },
  {
    left: "10%",
    right: "8%",
    top: "63%",
    height: "16%",
  },
];

// Chart dataZoom configuration
export const DATAZOOM_CONFIG: DataZoomComponentOption[] = [
  {
    type: "inside",
    xAxisIndex: [0, 1],
    start: 0,
    end: 100,
  },
  {
    show: true,
    xAxisIndex: [0, 1],
    type: "slider",
    top: "85%",
    start: 0,
    end: 100,
  },
];
