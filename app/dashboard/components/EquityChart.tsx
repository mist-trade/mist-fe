"use client";

import React, { useMemo } from "react";
import type { EquityPoint } from "../lib/types";
import { ChartContainer } from "@/app/components/charts/ChartContainer";
import { TradingViewLineChart } from "@/app/components/tv-chart/TradingViewLineChart";
import { LIGHT_TOKENS, DARK_TOKENS } from "@/app/styles/tokens";
import { useThemeName } from "@/app/styles/ThemeProvider";

export interface EquityChartProps {
  data: EquityPoint[];
  loading?: boolean;
  isEmpty?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

/**
 * 累计收益曲线：策略 + 基准 + 超额（三条 line）。
 */
export function EquityChart({
  data,
  loading,
  isEmpty,
  error,
  onRetry,
}: EquityChartProps) {
  const themeName = useThemeName();
  const tokens = themeName === "dark" ? DARK_TOKENS : LIGHT_TOKENS;

  const seriesData = useMemo(() => {
    if (!data || data.length === 0) return [];
    return [
      {
        name: "策略",
        color: tokens.brand,
        data: data.map((d) => ({ time: d.date, value: d.strategy })),
      },
      {
        name: "基准",
        color: tokens.semBenchmark,
        data: data.map((d) => ({ time: d.date, value: d.benchmark })),
      },
      {
        name: "超额",
        color: tokens.semExcess,
        data: data.map((d) => ({ time: d.date, value: d.excess })),
      },
    ];
  }, [data, tokens]);

  return (
    <ChartContainer
      height={320}
      loading={loading}
      isEmpty={isEmpty || data.length === 0}
      emptyText="暂无权益数据"
      error={error}
      onRetry={onRetry}
      ariaLabel="累计收益与基准对比曲线"
    >
      <TradingViewLineChart series={seriesData} height={300} />
    </ChartContainer>
  );
}

export default EquityChart;
