"use client";

import React, { useEffect, useRef } from "react";
import {
  createChart,
  type IChartApi,
  type UTCTimestamp,
  ColorType,
  CrosshairMode,
} from "lightweight-charts";
import { useTheme } from "next-themes";

import {
  formatShanghaiDateTime,
  formatShanghaiDate,
  toUTCTimestamp,
} from "@/app/lib/time";

export interface MultiLineSeriesData {
  name: string;
  color: string;
  data: Array<{ time: string; value: number }>;
}

export interface TradingViewLineChartProps {
  series: MultiLineSeriesData[];
  height?: number;
  areaSeries?: boolean;
  valueFormatter?: (val: number) => string;
  className?: string;
}

export function TradingViewLineChart({
  series,
  height = 280,
  areaSeries = false,
  className = "",
}: TradingViewLineChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  useEffect(() => {
    if (!containerRef.current) return;

    const bgColor = isDark ? "#141414" : "#FFFFFF";
    const textColor = isDark ? "#A0A0A0" : "#434343";
    const gridColor = isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.05)";

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: bgColor },
        textColor,
        fontSize: 12,
      },
      grid: {
        vertLines: { color: gridColor },
        horzLines: { color: gridColor },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      localization: {
        dateFormat: "yyyy-MM-dd",
        timeFormatter: (timestamp: number) => {
          return formatShanghaiDateTime(timestamp * 1000);
        },
      },
      timeScale: {
        borderColor: gridColor,
        timeVisible: false,
        tickMarkFormatter: (timestamp: number) => {
          return formatShanghaiDate(timestamp * 1000);
        },
      },
      rightPriceScale: {
        borderColor: gridColor,
      },
    });

    chartRef.current = chart;

    series.forEach((s) => {
      if (areaSeries) {
        const area = chart.addAreaSeries({
          lineColor: s.color,
          topColor: `${s.color}40`,
          bottomColor: `${s.color}05`,
          lineWidth: 2,
          title: s.name,
        });
        const formattedData = s.data
          .filter((d) => Number.isFinite(d.value))
          .map((d) => ({
            time: toUTCTimestamp(d.time),
            value: d.value,
          }))
          .sort((a, b) => (a.time as number) - (b.time as number));
        area.setData(formattedData);
      } else {
        const line = chart.addLineSeries({
          color: s.color,
          lineWidth: 2,
          title: s.name,
        });
        const formattedData = s.data
          .filter((d) => Number.isFinite(d.value))
          .map((d) => ({
            time: toUTCTimestamp(d.time),
            value: d.value,
          }))
          .sort((a, b) => (a.time as number) - (b.time as number));
        line.setData(formattedData);
      }
    });

    chart.timeScale().fitContent();

    const handleResize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: containerRef.current.clientWidth,
        });
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [isDark, height, series, areaSeries]);

  return (
    <div
      ref={containerRef}
      className={`w-full relative rounded-lg overflow-hidden ${className}`}
      style={{ height }}
    />
  );
}

export default TradingViewLineChart;
