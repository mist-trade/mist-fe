"use client";

import { useCallback, useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { LineChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  DataZoomComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { useThemeName } from "@/app/styles/ThemeProvider";
import {
  registerMistThemes,
  themeNameToEcharts,
} from "@/app/components/charts/echarts-theme";
import { LIGHT_TOKENS, DARK_TOKENS } from "@/app/styles/tokens";
import type { DrawdownPoint } from "../lib/types";
import { formatPercent } from "../lib/format";
import { ChartContainer } from "@/app/components/charts/ChartContainer";

echarts.use([
  LineChart,
  GridComponent,
  TooltipComponent,
  DataZoomComponent,
  CanvasRenderer,
]);

export interface DrawdownChartProps {
  data: DrawdownPoint[];
  loading?: boolean;
  isEmpty?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

/**
 * 回撤曲线：line + area，填充风险色（琥珀）。
 * 0 轴标线，tooltip 显示当日回撤值。
 */
export function DrawdownChart({
  data,
  loading,
  isEmpty,
  error,
  onRetry,
}: DrawdownChartProps) {
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
        grid: { left: "8%", right: "5%", top: 20, bottom: 60 },
        xAxis: {
          type: "category",
          data: d.map((p) => p.date),
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
          max: 0,
        },
        dataZoom: [
          { type: "inside" },
          { type: "slider", height: 20, bottom: 8 },
        ],
        series: [
          {
            name: "回撤",
            type: "line",
            data: d.map((p) => p.drawdown),
            showSymbol: false,
            lineStyle: { width: 1.5, color: t.semRisk },
            itemStyle: { color: t.semRisk },
            areaStyle: { color: hexA(t.semRisk, 0.15) },
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

  useEffect(() => {
    if (chartRef.current) setOption(chartRef.current);
  }, [data, setOption]);

  return (
    <ChartContainer
      height={200}
      loading={loading}
      isEmpty={isEmpty || data.length === 0}
      emptyText="暂无回撤数据"
      error={error}
      onRetry={onRetry}
      containerRef={containerRef}
      ariaLabel="最大回撤区间曲线"
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
