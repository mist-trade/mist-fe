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
import { formatShanghaiDateTime, formatShanghaiTime } from "@/app/lib/time";

function toUTCTimestamp(time: string | Date | number): UTCTimestamp {
  const ms = new Date(time).getTime();
  return Math.floor(ms / 1000) as UTCTimestamp;
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
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
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
          return formatShanghaiDateTime(timestamp * 1000);
        },
      },
      timeScale: {
        borderColor: gridColor,
        timeVisible: true,
        secondsVisible: false,
        tickMarkFormatter: (timestamp: number) => {
          return formatShanghaiTime(timestamp * 1000);
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

    const sortedK = [...k]
      .map((item) => ({
        ...item,
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
        } else {
          biLines.push(cmd);
        }
      } else if (cmd.type === "band") {
        zsBands.push(cmd);
      } else if (cmd.type === "text") {
        if (cmd.time) {
          const isSell = cmd.position === "above" || (cmd.text && cmd.text.includes("卖"));
          markers.push({
            time: toUTCTimestamp(cmd.time),
            position: isSell ? "aboveBar" : "belowBar",
            color: isSell ? "#22C55E" : "#EF4444",
            shape: isSell ? "arrowDown" : "arrowUp",
            text: cmd.text || "",
            size: 1.2,
          });
        }
      }
    }

    // 3.1 Draw Bi Lines (Yellow, 1px)
    if (biLines.length > 0) {
      const biSeries = chart.addLineSeries({
        color: "#FACC15",
        lineWidth: 1.2,
        title: "笔",
        crosshairMarkerVisible: false,
      });

      const biDataPoints: LineData[] = [];
      const biSeen = new Map<number, number>();
      for (const line of biLines) {
        if (line.startTime && line.startPrice !== undefined) {
          const t1 = toUTCTimestamp(line.startTime);
          const p1 = Number(line.startPrice);
          if (Number.isFinite(p1)) {
            biSeen.set(t1, p1);
          }
        }
        if (line.endTime && line.endPrice !== undefined) {
          const t2 = toUTCTimestamp(line.endTime);
          const p2 = Number(line.endPrice);
          if (Number.isFinite(p2)) {
            biSeen.set(t2, p2);
          }
        }
      }

      Array.from(biSeen.entries())
        .sort((a, b) => a[0] - b[0])
        .forEach(([time, value]) => {
          biDataPoints.push({ time: time as UTCTimestamp, value });
        });

      if (biDataPoints.length > 0) {
        biSeries.setData(biDataPoints);
        strokeSeriesRef.current.set("chan_bi", biSeries);
      }
    }

    // 3.2 Draw Duan Lines (Magenta, 2.5px)
    if (duanLines.length > 0) {
      const duanSeries = chart.addLineSeries({
        color: "#E879F9",
        lineWidth: 2.5,
        title: "线段",
        crosshairMarkerVisible: false,
      });

      const duanDataPoints: LineData[] = [];
      const duanSeen = new Map<number, number>();
      for (const line of duanLines) {
        if (line.startTime && line.startPrice !== undefined) {
          const t1 = toUTCTimestamp(line.startTime);
          const p1 = Number(line.startPrice);
          if (Number.isFinite(p1)) {
            duanSeen.set(t1, p1);
          }
        }
        if (line.endTime && line.endPrice !== undefined) {
          const t2 = toUTCTimestamp(line.endTime);
          const p2 = Number(line.endPrice);
          if (Number.isFinite(p2)) {
            duanSeen.set(t2, p2);
          }
        }
      }

      Array.from(duanSeen.entries())
        .sort((a, b) => a[0] - b[0])
        .forEach(([time, value]) => {
          duanDataPoints.push({ time: time as UTCTimestamp, value });
        });

      if (duanDataPoints.length > 0) {
        duanSeries.setData(duanDataPoints);
        strokeSeriesRef.current.set("chan_duan", duanSeries);
      }
    }

    // 3.3 Overlay Canvas: Render Zhongshu (中枢) Boxes with 4 closed borders & translucent fill
    const drawZhongshuOverlay = () => {
      const canvas = overlayCanvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container || !chartRef.current || !candleSeriesRef.current) return;

      const currentChart = chartRef.current;
      const currentCandle = candleSeriesRef.current;
      const width = container.clientWidth;
      const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      for (const band of zsBands) {
        if (
          !band.fromTime ||
          !band.toTime ||
          band.top === undefined ||
          band.bottom === undefined
        ) {
          continue;
        }

        const t1 = toUTCTimestamp(band.fromTime);
        const t2 = toUTCTimestamp(band.toTime);
        const top = Number(band.top);
        const bottom = Number(band.bottom);
        if (!Number.isFinite(top) || !Number.isFinite(bottom) || t2 <= t1) {
          continue;
        }

        const x1 = currentChart.timeScale().timeToCoordinate(t1);
        const x2 = currentChart.timeScale().timeToCoordinate(t2);
        const yTop = currentCandle.priceToCoordinate(top);
        const yBottom = currentCandle.priceToCoordinate(bottom);

        if (x1 !== null && x2 !== null && yTop !== null && yBottom !== null) {
          const xLeft = Math.min(x1, x2);
          const xRight = Math.max(x1, x2);
          const yUpper = Math.min(yTop, yBottom);
          const yLower = Math.max(yTop, yBottom);
          const boxW = Math.max(2, xRight - xLeft);
          const boxH = Math.max(1, yLower - yUpper);

          const isDuan = band.layer === "chan_zs_duan";
          const strokeColor = isDuan ? "#818CF8" : "#38BDF8";
          const fillColor = isDuan
            ? "rgba(129, 140, 248, 0.15)"
            : "rgba(56, 189, 248, 0.12)";

          // 1. Fill background box
          ctx.fillStyle = fillColor;
          ctx.fillRect(xLeft, yUpper, boxW, boxH);

          // 2. Stroke all 4 borders (Top ZG, Bottom ZD, Left vertical, Right vertical)
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = isDuan ? 2 : 1.5;
          if (isDuan) {
            ctx.setLineDash([]);
          } else {
            ctx.setLineDash([4, 2]);
          }
          ctx.strokeRect(xLeft, yUpper, boxW, boxH);

          // 3. Label tag
          ctx.setLineDash([]);
          ctx.fillStyle = strokeColor;
          ctx.font = "11px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
          const label = isDuan ? "段中枢" : "笔中枢";
          const textY = yUpper - 4 > 12 ? yUpper - 4 : yUpper + 12;
          ctx.fillText(
            `${label} [${bottom.toFixed(2)} - ${top.toFixed(2)}]`,
            xLeft + 4,
            textY
          );
        }
      }
    };

    // Initial draw & subscribe to time scale scroll/pan/zoom
    requestAnimationFrame(drawZhongshuOverlay);
    chart.timeScale().subscribeVisibleLogicalRangeChange(drawZhongshuOverlay);
    chart.timeScale().subscribeVisibleTimeRangeChange(drawZhongshuOverlay);

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
        requestAnimationFrame(drawZhongshuOverlay);
        return;
      }
    }

    chart.timeScale().fitContent();
    requestAnimationFrame(drawZhongshuOverlay);
  }, [k, commands, focusedSignalTime, height]);

  return (
    <div
      ref={containerRef}
      className={`w-full relative rounded-lg overflow-hidden ${className}`}
      style={{ height }}
    >
      <canvas
        ref={overlayCanvasRef}
        className="pointer-events-none absolute inset-0 z-10"
      />
    </div>
  );
}

export default TradingViewChart;
