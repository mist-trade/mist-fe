import * as echarts from "echarts/core";
import { LIGHT_TOKENS, DARK_TOKENS, FONT_SANS, type ThemeName } from "@/app/styles/tokens";

/**
 * 主题对象的结构：ECharts 的 registerTheme 接受一个宽松对象，
 * 官方未导出精确类型，此处用宽松结构标注。
 */
type EChartsTheme = Record<string, unknown>;

export const MIST_THEMES = {
  light: "mist-light",
  dark: "mist-dark",
} as const;

/** ECharts 主题名 → 我们的 ThemeName。 */
export function themeNameToEcharts(name: ThemeName): string {
  return name === "dark" ? MIST_THEMES.dark : MIST_THEMES.light;
}

let registered = false;

/**
 * 注册 mist-light / mist-dark 主题。幂等，多次调用安全。
 * 在客户端首次使用图表前调用一次（ChartContainer / useChartRender 负责触发）。
 *
 * 主题色取自 tokens.ts，与 themes.css、antd ConfigProvider 同源。
 */
export function registerMistThemes(): void {
  if (registered) return;
  if (typeof window === "undefined") return;

  echarts.registerTheme(MIST_THEMES.light, buildThemeOption(LIGHT_TOKENS));
  echarts.registerTheme(MIST_THEMES.dark, buildThemeOption(DARK_TOKENS));
  registered = true;
}

/**
 * 构建单个主题的 ECharts 主题对象。
 * 统一背景/文本/网格/tooltip/categorical 调色板，避免裸 hex 散落。
 */
/**
 * 构建单个主题的 ECharts 主题对象。
 * 统一背景/文本/网格/tooltip/categorical 调色板，避免裸 hex 散落。
 */
function buildThemeOption(
  t: typeof LIGHT_TOKENS | typeof DARK_TOKENS
): EChartsTheme {
  return {
    // 背景透明，让 CSS 容器（--surface-raised）决定底色
    color: [
      t.semUp,
      t.semDown,
      t.semBenchmark,
      t.semExcess,
      t.semRisk,
      t.chanBiValid,
      t.chanFenxingTop,
      t.chanFenxingBottom,
      t.chanZhongshuComplete,
      t.chanZhongshuUncomplete,
    ],
    backgroundColor: "transparent",
    textStyle: {
      color: t.textSecondary,
      fontFamily: FONT_SANS,
    },
    title: {
      textStyle: { color: t.textPrimary },
      subtextStyle: { color: t.textSecondary },
    },
    legend: {
      textStyle: { color: t.textSecondary },
      inactiveColor: t.textMuted,
    },
    tooltip: {
      backgroundColor: t.surfaceOverlay,
      borderColor: t.borderSubtle,
      borderWidth: 1,
      textStyle: { color: t.textPrimary },
    },
    categoryAxis: {
      axisLine: { lineStyle: { color: t.borderStrong } },
      axisTick: { lineStyle: { color: t.borderStrong } },
      axisLabel: { color: t.textSecondary },
      splitLine: { show: false, lineStyle: { color: t.borderSubtle } },
      splitArea: { show: false },
    },
    valueAxis: {
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: t.textMuted },
      splitLine: { show: true, lineStyle: { color: t.borderSubtle } },
      splitArea: { show: false },
    },
    dataZoom: {
      backgroundColor: t.surfaceRaised,
      dataBackgroundColor: t.surfaceBase,
      fillerColor: hexToRgbaLocal(t.brand, 0.08),
      handleColor: t.brand,
      handleSize: "120%",
      textStyle: { color: t.textSecondary },
    },
  };
}

/** 本地 hex→rgba，避免与 chartColors 的导出耦合。 */
function hexToRgbaLocal(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const r = Number.parseInt(clean.substring(0, 2), 16);
  const g = Number.parseInt(clean.substring(2, 4), 16);
  const b = Number.parseInt(clean.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
