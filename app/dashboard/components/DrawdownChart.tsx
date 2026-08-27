"use client";

import React, { useMemo } from "react";
import type { DrawdownPoint } from "../lib/types";
import { ChartContainer } from "@/app/components/charts/ChartContainer";
import { TradingViewLineChart } from "@/app/components/tv-chart/TradingViewLineChart";
import { LIGHT_TOKENS, DARK_TOKENS } from "@/app/styles/tokens";
import { useThemeName } from "@/app/styles/ThemeProvider";

export interface DrawdownChartProps {
  data: DrawdownPoint[];
  loading?: boolean;
  isEmpty?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

/**
 * 回撤曲线：area 填充风险色（琥珀色）。
 */
export function DrawdownChart({
  data,
  loading,
  isEmpty,
  error,
  onRetry,
}: DrawdownChartProps) {
  const themeName = useThemeName();
  const tokens = themeName === "dark" ? DARK_TOKENS : LIGHT_TOKENS;

  const seriesData = useMemo(() => {
    if (!data || data.length === 0) return [];
    return [
      {
        name: "回撤",
        color: tokens.semRisk,
        data: data.map((d) => ({ time: d.date, value: d.drawdown })),
      },
    ];
  }, [data, tokens]);

  return (
    <ChartContainer
      height={200}
      loading={loading}
      isEmpty={isEmpty || data.length === 0}
      emptyText="暂无回撤数据"
      error={error}
      onRetry={onRetry}
      ariaLabel="最大回撤区间曲线"
    >
      <TradingViewLineChart series={seriesData} height={180} areaSeries={true} />
    </ChartContainer>
  );
}

export default DrawdownChart;
