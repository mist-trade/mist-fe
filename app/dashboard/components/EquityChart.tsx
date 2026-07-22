"use client";

import { useCallback, useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { LineChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { useThemeName } from "@/app/styles/ThemeProvider";
import {
  registerMistThemes,
  themeNameToEcharts,
} from "@/app/components/charts/echarts-theme";
import { LIGHT_TOKENS, DARK_TOKENS } from "@/app/styles/tokens";
import type { EquityPoint } from "../lib/types";
import { formatPercent } from "../lib/format";
import { ChartContainer } from "@/app/components/charts/ChartContainer";

echarts.use([
  LineChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  CanvasRenderer,
]);

export interface EquityChartProps {
  data: EquityPoint[];
  loading?: boolean;
  isEmpty?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

/**
 * 累计收益曲线：策略 + 基准 + 超额（三条 line）。
 * - 策略/基准用涨跌正交色（策略=品牌青偏中性、基准=靛蓝）
 * - 超额用紫色，与基准区分
 * - 超额 0 轴标线
 * - dataZoom inside + slider，tooltip 显示三线对比 + 数据时间
 *
 * 注：此处"策略"用中性色而非涨跌色，因为这是对比图，涨跌语义留给 K 线/盈亏表。
 */
export function EquityChart({
  data,
  loading,
  isEmpty,
  error,
  onRetry,
}: EquityChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const themeName = useThemeName();
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    registerMistThemes();
  }, []);

  const setOption = useCallback(
    (chart: echarts.ECharts) => {
      const t = themeName === "dark" ? DARK_TOKENS : LIGHT_TOKENS;
      const d = dataRef.current;
      const dates = d.map((p) => p.date);
      chart.setOption({
        backgroundColor: "transparent",
        tooltip: {
          trigger: "axis",
          backgroundColor: t.surfaceOverlay,
          borderColor: t.borderSubtle,
          textStyle: { color: t.textPrimary },
          valueFormatter: (val: unknown) =>
            formatPercent(typeof val === "number" ? val : 0),
        },
        legend: {
          data: ["策略", "基准", "超额"],
          textStyle: { color: t.textSecondary },
          top: 0,
        },
        grid: { left: "8%", right: "5%", top: 40, bottom: 60 },
        xAxis: {
          type: "category",
          data: dates,
          axisLine: { lineStyle: { color: t.borderStrong } },
          axisLabel: { color: t.textMuted },
        },
        yAxis: {
          type: "value",
          axisLabel: {
            color: t.textMuted,
            formatter: (v: number) => formatPercent(v, 0),
          },
          splitLine: { lineStyle: { color: t.borderSubtle } },
        },
        dataZoom: [
          { type: "inside" },
          { type: "slider", height: 20, bottom: 8 },
        ],
        series: [
          {
            name: "策略",
            type: "line",
            data: d.map((p) => p.strategy),
            showSymbol: false,
            lineStyle: { width: 2, color: t.brand },
            itemStyle: { color: t.brand },
          },
          {
            name: "基准",
            type: "line",
            data: d.map((p) => p.benchmark),
            showSymbol: false,
            lineStyle: { width: 1.5, color: t.semBenchmark, type: "dashed" },
            itemStyle: { color: t.semBenchmark },
          },
          {
            name: "超额",
            type: "line",
            data: d.map((p) => p.excess),
            showSymbol: false,
            lineStyle: { width: 1.5, color: t.semExcess },
            itemStyle: { color: t.semExcess },
            areaStyle: { color: hexA(t.semExcess, 0.1) },
            markLine: {
              silent: true,
              symbol: "none",
              lineStyle: { color: t.borderStrong, type: "dotted" },
              data: [{ yAxis: 0 }],
            },
          },
        ],
      });
    },
    [themeName]
  );

  // 初始化 + 主题重建
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const chart = echarts.init(el, themeNameToEcharts(themeName));
    chartRef.current = chart;
    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(el);
    setOption(chart);
    return () => {
      ro.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, [themeName, setOption]);

  // 数据变化重绘
  useEffect(() => {
    if (chartRef.current) setOption(chartRef.current);
  }, [data, setOption]);

  return (
    <ChartContainer
      height={320}
      loading={loading}
      isEmpty={isEmpty || data.length === 0}
      emptyText="暂无权益数据"
      error={error}
      onRetry={onRetry}
      containerRef={containerRef}
      ariaLabel="累计收益与基准对比曲线"
    />
  );
}

function hexA(hex: string, alpha: number): string {
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
