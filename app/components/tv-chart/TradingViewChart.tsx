"use client";

import React, { useEffect, useRef } from "react";
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type HistogramData,
  type LineData,
  type SeriesMarker,
  type UTCTimestamp,
  ColorType,
  CrosshairMode,
} from "lightweight-charts";
import { useTheme } from "next-themes";
import type { TradingViewChartProps } from "./types";
import type { VisualCommandVo } from "@/app/api/client";

export function toUTCTimestamp(time: string | Date | number): UTCTimestamp {
  const ms = new Date(time).getTime();
  if (!Number.isFinite(ms)) {
    throw new RangeError(`Invalid time value for toUTCTimestamp: ${String(time)}`);
  }
  return Math.floor(ms / 1000) as UTCTimestamp;
}

function isSellPosition(position: string | undefined, text: string | undefined): boolean {
  if (position === 'above') return true;
  if (position === 'below') return false;
  // Strict layer/position check first; only fall back to text heuristic for legacy data without position
  if (text) {
    return text.includes('卖');
  }
  return false;
}

export function TradingViewChart({
  k,
  commands = [],
  height = 550,
  subChartType = "volume",
  className = "",
  focusedSignalTime = null,
}: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const strokeSeriesRef = useRef<Map<string, ISeriesApi<"Line">>>(new Map());

  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  // 1. Initialize Chart
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
          const d = new Date(timestamp * 1000);
          return d.toLocaleString("zh-CN", {
            timeZone: "Asia/Shanghai",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          });
        },
      },
      timeScale: {
        borderColor: gridColor,
        timeVisible: true,
        secondsVisible: false,
        tickMarkFormatter: (timestamp: number) => {
          const d = new Date(timestamp * 1000);
          return d.toLocaleTimeString("zh-CN", {
            timeZone: "Asia/Shanghai",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          });
        },
      },
      rightPriceScale: {
        borderColor: gridColor,
        scaleMargins: {
          top: 0.08,
          bottom: subChartType === "volume" ? 0.22 : 0.08,
        },
      },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: "#EF4444",
      downColor: "#22C55E",
      borderUpColor: "#EF4444",
      borderDownColor: "#22C55E",
      wickUpColor: "#EF4444",
      wickDownColor: "#22C55E",
    });

    // Volume histogram series
    let volumeSeries: ISeriesApi<"Histogram"> | null = null;
    if (subChartType === "volume") {
      volumeSeries = chart.addHistogramSeries({
        priceFormat: { type: "volume" },
        priceScaleId: "volume",
      });
      chart.priceScale("volume").applyOptions({
        scaleMargins: {
          top: 0.8,
          bottom: 0,
        },
      });
    }

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    const handleResize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: containerRef.current.clientWidth,
        });
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(containerRef.current);

    const strokeSeries = strokeSeriesRef.current;
    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      strokeSeries.clear();
    };
  }, [isDark, height, subChartType]);

  // 2. Feed K-line Data & Visual Commands
  useEffect(() => {
    const chart = chartRef.current;
    const candleSeries = candleSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;
    if (!chart || !candleSeries || !k || k.length === 0) return;

    // Deduplicate and convert K-lines by ascending timestamp
    const sortedK = [...k]
      .map((item) => ({
        time: item.time,
        open: Number(item.open),
        high: Number(item.high),
        low: Number(item.low),
        close: Number(item.close),
        volume:
          item.volume !== undefined && item.volume !== null
            ? Number(item.volume)
            : item.amount !== undefined && item.amount !== null
            ? Number(item.amount)
            : undefined,
      }))
      .filter(
        (item) =>
          Number.isFinite(item.open) &&
          Number.isFinite(item.high) &&
          Number.isFinite(item.low) &&
          Number.isFinite(item.close)
      )
      .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

    const seenTimes = new Set<number>();
    const candleData: CandlestickData[] = [];
    const volumeData: HistogramData[] = [];

    for (const item of sortedK) {
      const t = toUTCTimestamp(item.time);
      if (seenTimes.has(t)) continue;
      seenTimes.add(t);

      const open = item.open;
      const close = item.close;
      const isUp = close >= open;

      candleData.push({
        time: t,
        open,
        high: item.high,
        low: item.low,
        close,
      });

      if (item.volume !== undefined && Number.isFinite(item.volume)) {
        volumeData.push({
          time: t,
          value: item.volume,
          color: isUp ? "rgba(239, 68, 68, 0.4)" : "rgba(34, 197, 94, 0.4)",
        });
      }
    }

    candleSeries.setData(candleData);

    if (volumeSeries && volumeData.length > 0) {
      volumeSeries.setData(volumeData);
    }

    // Clean up old stroke series
    strokeSeriesRef.current.forEach((series) => {
      chart.removeSeries(series);
    });
    strokeSeriesRef.current.clear();

    if (!commands || commands.length === 0) {
      chart.timeScale().fitContent();
      return;
    }

    // 3. Process Visual Commands
    const markers: SeriesMarker<UTCTimestamp>[] = [];
    const biLines: VisualCommandVo[] = [];
    const duanLines: VisualCommandVo[] = [];
    const zsBands: VisualCommandVo[] = [];

    for (const cmd of commands) {
      if (cmd.type === "line") {
        if (cmd.layer === "chan_duan") {
          duanLines.push(cmd);
        } else if (cmd.layer === "chan_bi") {
          biLines.push(cmd);
        } else {
          // Unknown line layer — ignore rather than misclassifying as bi
          continue;
        }
      } else if (cmd.type === "band") {
        // Only chan_zs_bi / chan_zs_duan are valid zhongshu bands
        if (cmd.layer === "chan_zs_bi" || cmd.layer === "chan_zs_duan" || cmd.layer === "chan_zs") {
          zsBands.push(cmd);
        }
      } else if (cmd.type === "text") {
        // Only BSP texts should become markers; ignore other text layers
        if (cmd.time && cmd.layer === "chan_bsp") {
          const isSell = isSellPosition(cmd.position, cmd.text);
          markers.push({
            time: toUTCTimestamp(cmd.time),
            position: isSell ? "aboveBar" : "belowBar",
            color: cmd.color || (isSell ? "#22C55E" : "#EF4444"),
            shape: isSell ? "arrowDown" : "arrowUp",
            text: cmd.text || "",
            size: 1.2,
          });
        }
      } else if (cmd.type === "icon") {
        // Icon commands are handled separately if needed; skip for now
        continue;
      }
    }

    // 3.1 Draw Bi Lines — one LineSeries per Bi to avoid cross-gap connections
    if (biLines.length > 0) {
      // Sort by startTime to keep deterministic layer ordering
      const sortedBi = [...biLines].sort((a, b) => {
        const ta = a.startTime ? new Date(a.startTime).getTime() : 0;
        const tb = b.startTime ? new Date(b.startTime).getTime() : 0;
        return ta - tb;
      });
      sortedBi.forEach((line, idx) => {
        if (!line.startTime || !line.endTime || line.startPrice === undefined || line.endPrice === undefined) return;
        const t1 = toUTCTimestamp(line.startTime);
        const t2 = toUTCTimestamp(line.endTime);
        const p1 = Number(line.startPrice);
        const p2 = Number(line.endPrice);
        if (!Number.isFinite(p1) || !Number.isFinite(p2)) return;
        if (t1 === t2 && p1 === p2) return;
        const biSeries = chart.addLineSeries({
          color: line.color || "#FACC15",
          lineWidth: (line.width as 1 | 2 | 3 | 4) ?? 1,
          lineStyle: line.style === "dashed" ? 1 : line.style === "dotted" ? 2 : 0,
          title: idx === 0 ? "笔" : undefined,
          crosshairMarkerVisible: false,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        biSeries.setData([
          { time: t1, value: p1 },
          { time: t2, value: p2 },
        ]);
        strokeSeriesRef.current.set(`chan_bi_${idx}`, biSeries);
      });
    }

    // 3.2 Draw Duan Lines — one LineSeries per Duan
    if (duanLines.length > 0) {
      const sortedDuan = [...duanLines].sort((a, b) => {
        const ta = a.startTime ? new Date(a.startTime).getTime() : 0;
        const tb = b.startTime ? new Date(b.startTime).getTime() : 0;
        return ta - tb;
      });
      sortedDuan.forEach((line, idx) => {
        if (!line.startTime || !line.endTime || line.startPrice === undefined || line.endPrice === undefined) return;
        const t1 = toUTCTimestamp(line.startTime);
        const t2 = toUTCTimestamp(line.endTime);
        const p1 = Number(line.startPrice);
        const p2 = Number(line.endPrice);
        if (!Number.isFinite(p1) || !Number.isFinite(p2)) return;
        if (t1 === t2 && p1 === p2) return;
        const duanSeries = chart.addLineSeries({
          color: line.color || "#E879F9",
          lineWidth: (line.width as 1 | 2 | 3 | 4) ?? 2,
          lineStyle: line.style === "dashed" ? 1 : line.style === "dotted" ? 2 : 0,
          title: idx === 0 ? "线段" : undefined,
          crosshairMarkerVisible: false,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        duanSeries.setData([
          { time: t1, value: p1 },
          { time: t2, value: p2 },
        ]);
        strokeSeriesRef.current.set(`chan_duan_${idx}`, duanSeries);
      });
    }

    // 3.3 Draw Zhongshu — use band id for stable keys, consume fill/top/bottom + gg/dd
    // zs bands already filtered to valid layers; render each as zg/zd pair
    // Support both legacy chan_zs and new chan_zs_bi / chan_zs_duan with distinct default colors
    const getZsDefaultColor = (layer: string) => {
      if (layer === "chan_zs_duan") return "#818CF8";
      return "#38BDF8";
    };
    zsBands.forEach((band) => {
      if (band.fromTime && band.toTime && band.top !== undefined && band.bottom !== undefined) {
        const t1 = toUTCTimestamp(band.fromTime);
        const t2 = toUTCTimestamp(band.toTime);
        const top = Number(band.top);
        const bottom = Number(band.bottom);
        if (t2 > t1 && Number.isFinite(top) && Number.isFinite(bottom)) {
          const color = band.color || getZsDefaultColor(band.layer);
          const zgSeries = chart.addLineSeries({
            color,
            lineWidth: 1,
            lineStyle: 0, // Solid
            crosshairMarkerVisible: false,
            priceLineVisible: false,
            lastValueVisible: false,
          });
          const zdSeries = chart.addLineSeries({
            color,
            lineWidth: 1,
            lineStyle: 0, // Solid
            crosshairMarkerVisible: false,
            priceLineVisible: false,
            lastValueVisible: false,
          });

          zgSeries.setData([
            { time: t1, value: top },
            { time: t2, value: top },
          ]);
          zdSeries.setData([
            { time: t1, value: bottom },
            { time: t2, value: bottom },
          ]);

          // Use band id as stable key — fallback to fromTime+layer hash if id missing
          const keyBase = band.id || `${band.layer}_${band.fromTime}_${band.toTime}_${top}_${bottom}`;
          strokeSeriesRef.current.set(`zs_zg_${keyBase}`, zgSeries);
          strokeSeriesRef.current.set(`zs_zd_${keyBase}`, zdSeries);
        }
      }
    });

    // 3.4 Set Markers (1买/2买/3买)
    if (markers.length > 0) {
      markers.sort((a, b) => (a.time as number) - (b.time as number));
      candleSeries.setMarkers(markers);
    }


    // 3.5 Auto-Focus or FitContent
    if (focusedSignalTime) {
      const focusTimestamp = toUTCTimestamp(focusedSignalTime);
      const matchIndex = candleData.findIndex((d) => d.time === focusTimestamp);
      if (matchIndex >= 0) {
        const fromIdx = Math.max(0, matchIndex - 30);
        const toIdx = Math.min(candleData.length - 1, matchIndex + 30);
        chart.timeScale().setVisibleLogicalRange({
          from: fromIdx,
          to: toIdx,
        });
        return;
      }
    }

    chart.timeScale().fitContent();
  }, [k, commands, focusedSignalTime]);

  return (
    <div
      ref={containerRef}
      className={`w-full relative rounded-lg overflow-hidden ${className}`}
      style={{ height }}
    />
  );
}

export default TradingViewChart;
