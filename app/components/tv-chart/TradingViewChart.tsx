"use client";

import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type HistogramData,
  type LineData,
  type SeriesMarker,
  type UTCTimestamp,
  type MouseEventParams,
  ColorType,
  CrosshairMode,
} from "lightweight-charts";
import { useTheme } from "next-themes";
import type { OhlcHoverVo, TradingViewChartProps } from "./types";
import type { VisualCommandVo } from "@/app/api/client";
import {
  formatShanghaiDateTime,
  formatShanghaiTime,
  toUTCTimestamp,
} from "@/app/lib/time";

function formatPrice(v: number): string {
  if (!Number.isFinite(v)) return "-";
  return v.toFixed(2);
}

function formatVolOrAmount(v?: number): string {
  if (v === undefined || v === null || !Number.isFinite(v)) return "-";
  if (Math.abs(v) >= 1000) return v.toLocaleString("zh-CN", { maximumFractionDigits: 2 });
  return String(v);
}

type PreparedK = {
  map: Map<number, OhlcHoverVo>;
  candleData: CandlestickData[];
  volumeData: HistogramData[];
  lastVo: OhlcHoverVo | null;
};

function prepareK(k: TradingViewChartProps["k"]): PreparedK {
  if (!k || k.length === 0) {
    return { map: new Map(), candleData: [], volumeData: [], lastVo: null };
  }
  const sortedK = [...k]
    .map((item) => {
      const raw = item as unknown as Record<string, unknown>;
      const volRaw = (raw.volume ?? raw.vol) as number | undefined;
      const amtRaw = raw.amount as number | undefined;
      return {
        ...item,
        open: Number(item.open),
        high: Number(item.high),
        low: Number(item.low),
        close: Number(item.close),
        rawVolume: volRaw !== undefined && volRaw !== null ? Number(volRaw) : undefined,
        rawAmount: amtRaw !== undefined && amtRaw !== null ? Number(amtRaw) : undefined,
        timeMs: new Date(item.time as string | number | Date).getTime(),
      };
    })
    .filter(
      (item) =>
        Number.isFinite(item.open) &&
        Number.isFinite(item.high) &&
        Number.isFinite(item.low) &&
        Number.isFinite(item.close) &&
        Number.isFinite(item.timeMs)
    )
    .sort((a, b) => a.timeMs - b.timeMs);

  const seenTimes = new Set<number>();
  const candleData: CandlestickData[] = [];
  const volumeData: HistogramData[] = [];
  const map = new Map<number, OhlcHoverVo>();

  for (const item of sortedK) {
    const t = toUTCTimestamp(item.time);
    if (seenTimes.has(t as number)) continue;
    seenTimes.add(t as number);
    const open = item.open;
    const close = item.close;
    const isUp = close >= open;
    const timeLabel = formatShanghaiDateTime(item.time as string | number | Date);
    candleData.push({ time: t, open, high: item.high, low: item.low, close });
    const volForHistogram =
      item.rawVolume !== undefined && Number.isFinite(item.rawVolume)
        ? item.rawVolume
        : item.rawAmount !== undefined && Number.isFinite(item.rawAmount)
          ? item.rawAmount
          : undefined;
    if (volForHistogram !== undefined && Number.isFinite(volForHistogram)) {
      volumeData.push({
        time: t,
        value: volForHistogram,
        color: isUp ? "rgba(239, 68, 68, 0.4)" : "rgba(34, 197, 94, 0.4)",
      });
    }
    const hoverVo: OhlcHoverVo = {
      time: item.time,
      timeLabel,
      open,
      high: item.high,
      low: item.low,
      close,
      // V 与成交量柱同源：优先 volume/vol，缺失时用 amount 兜底，避免图有柱但图例 V 为 "-"
      volume: volForHistogram,
      amount: item.rawAmount,
      isUp,
    };
    map.set(t as number, hoverVo);
  }

  const lastVo = map.size > 0 ? Array.from(map.values()).at(-1)! : null;
  return { map, candleData, volumeData, lastVo };
}

export function TradingViewChart({
  k,
  commands = [],
  height = 550,
  subChartType = "volume",
  className = "",
  focusedSignalTime = null,
  showOhlcLegend = true,
  onOhlcHover,
}: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const strokeSeriesRef = useRef<Map<string, ISeriesApi<"Line">>>(new Map());

  const prepared = useMemo(() => prepareK(k), [k]);

  // hovered 为当前十字线命中的那根；为 null 时图例回落到 lastVo（常驻展示）
  const [hovered, setHovered] = useState<OhlcHoverVo | null>(null);
  const displayed = useMemo(() => {
    if (!hovered) return prepared.lastVo;
    // 若 hovered 已不在当前数据集（切换标的/区间），回落到 lastVo 而不在 render 中 setState
    const t = toUTCTimestamp(hovered.time);
    return prepared.map.has(t as number) ? hovered : prepared.lastVo;
  }, [hovered, prepared]);

  const onOhlcHoverRef = useRef(onOhlcHover);
  useEffect(() => {
    onOhlcHoverRef.current = onOhlcHover;
  }, [onOhlcHover]);
  useEffect(() => {
    onOhlcHoverRef.current?.(displayed ?? null);
  }, [displayed]);

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

    let volumeSeries: ISeriesApi<"Histogram"> | null = null;
    if (subChartType === "volume") {
      volumeSeries = chart.addHistogramSeries({
        priceFormat: { type: "volume" },
        priceScaleId: "volume",
      });
      chart.priceScale("volume").applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 },
      });
    }

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    const handleResize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
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

  const handleCrosshair = useCallback(
    (param: MouseEventParams) => {
      if (
        !param ||
        param.point === undefined ||
        !param.time ||
        param.logical === undefined
      ) {
        setHovered(null);
        return;
      }
      const t = param.time as unknown as number;
      const hit = prepared.map.get(t);
      if (hit) {
        setHovered(hit);
        return;
      }
      const candleSeries = candleSeriesRef.current;
      if (candleSeries) {
        const seriesData = param.seriesData?.get(candleSeries) as CandlestickData | undefined;
        if (seriesData && seriesData.time !== undefined) {
          const t2 = seriesData.time as unknown as number;
          const hit2 = prepared.map.get(t2);
          if (hit2) {
            setHovered(hit2);
            return;
          }
        }
      }
      setHovered(null);
    },
    [prepared]
  );

  // 2. Feed K-line Data & Visual Commands
  useEffect(() => {
    const chart = chartRef.current;
    const candleSeries = candleSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;
    if (!chart || !candleSeries) return;
    if (prepared.candleData.length === 0) {
      candleSeries.setData([]);
      volumeSeries?.setData([]);
    } else {
      candleSeries.setData(prepared.candleData);
      if (volumeSeries) {
        volumeSeries.setData(prepared.volumeData);
      }
    }

    strokeSeriesRef.current.forEach((series) => {
      chart.removeSeries(series);
    });
    strokeSeriesRef.current.clear();

    chart.subscribeCrosshairMove(handleCrosshair);
    const containerEl = containerRef.current;
    const handleMouseLeave = () => setHovered(null);
    containerEl?.addEventListener("mouseleave", handleMouseLeave);

    if (!commands || commands.length === 0) {
      chart.timeScale().fitContent();
      return () => {
        chart.unsubscribeCrosshairMove(handleCrosshair);
        containerEl?.removeEventListener("mouseleave", handleMouseLeave);
      };
    }

    const markers: SeriesMarker<UTCTimestamp>[] = [];
    const biLines: VisualCommandVo[] = [];
    const duanLines: VisualCommandVo[] = [];
    const zsBands: VisualCommandVo[] = [];

    for (const cmd of commands) {
      if (cmd.type === "line") {
        if (cmd.layer === "chan_duan") duanLines.push(cmd);
        else biLines.push(cmd);
      } else if (cmd.type === "band") {
        zsBands.push(cmd);
      } else if (cmd.type === "text" && cmd.time) {
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

    if (biLines.length > 0) {
      const biSeries = chart.addLineSeries({ color: "#FACC15", lineWidth: 1, title: "笔", crosshairMarkerVisible: false });
      const biSeen = new Map<number, number>();
      for (const line of biLines) {
        if (line.startTime && line.startPrice !== undefined) {
          const t1 = toUTCTimestamp(line.startTime);
          const p1 = Number(line.startPrice);
          if (Number.isFinite(p1)) biSeen.set(t1 as number, p1);
        }
        if (line.endTime && line.endPrice !== undefined) {
          const t2 = toUTCTimestamp(line.endTime);
          const p2 = Number(line.endPrice);
          if (Number.isFinite(p2)) biSeen.set(t2 as number, p2);
        }
      }
      const pts: LineData[] = Array.from(biSeen.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([time, value]) => ({ time: time as UTCTimestamp, value }));
      if (pts.length > 0) {
        biSeries.setData(pts);
        strokeSeriesRef.current.set("chan_bi", biSeries);
      }
    }

    if (duanLines.length > 0) {
      const duanSeries = chart.addLineSeries({ color: "#E879F9", lineWidth: 2, title: "线段", crosshairMarkerVisible: false });
      const duanSeen = new Map<number, number>();
      for (const line of duanLines) {
        if (line.startTime && line.startPrice !== undefined) {
          const t1 = toUTCTimestamp(line.startTime);
          const p1 = Number(line.startPrice);
          if (Number.isFinite(p1)) duanSeen.set(t1 as number, p1);
        }
        if (line.endTime && line.endPrice !== undefined) {
          const t2 = toUTCTimestamp(line.endTime);
          const p2 = Number(line.endPrice);
          if (Number.isFinite(p2)) duanSeen.set(t2 as number, p2);
        }
      }
      const pts: LineData[] = Array.from(duanSeen.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([time, value]) => ({ time: time as UTCTimestamp, value }));
      if (pts.length > 0) {
        duanSeries.setData(pts);
        strokeSeriesRef.current.set("chan_duan", duanSeries);
      }
    }

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
        if (!band.fromTime || !band.toTime || band.top === undefined || band.bottom === undefined) continue;
        const t1 = toUTCTimestamp(band.fromTime);
        const t2 = toUTCTimestamp(band.toTime);
        const top = Number(band.top);
        const bottom = Number(band.bottom);
        if (!Number.isFinite(top) || !Number.isFinite(bottom) || t2 <= t1) continue;
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
          const fillColor = isDuan ? "rgba(129, 140, 248, 0.15)" : "rgba(56, 189, 248, 0.12)";
          ctx.fillStyle = fillColor;
          ctx.fillRect(xLeft, yUpper, boxW, boxH);
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = isDuan ? 2 : 1.5;
          ctx.setLineDash(isDuan ? [] : [4, 2]);
          ctx.strokeRect(xLeft, yUpper, boxW, boxH);
          ctx.setLineDash([]);
          ctx.fillStyle = strokeColor;
          ctx.font = "11px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
          const label = isDuan ? "段中枢" : "笔中枢";
          const textY = yUpper - 4 > 12 ? yUpper - 4 : yUpper + 12;
          ctx.fillText(`${label} [${bottom.toFixed(2)} - ${top.toFixed(2)}]`, xLeft + 4, textY);
        }
      }
    };

    requestAnimationFrame(drawZhongshuOverlay);
    chart.timeScale().subscribeVisibleLogicalRangeChange(drawZhongshuOverlay);
    chart.timeScale().subscribeVisibleTimeRangeChange(drawZhongshuOverlay);

    if (markers.length > 0) {
      markers.sort((a, b) => (a.time as number) - (b.time as number));
      candleSeries.setMarkers(markers);
    }

    if (focusedSignalTime) {
      const focusTimestamp = toUTCTimestamp(focusedSignalTime);
      const matchIndex = prepared.candleData.findIndex((d) => d.time === focusTimestamp);
      if (matchIndex >= 0) {
        const fromIdx = Math.max(0, matchIndex - 30);
        const toIdx = Math.min(prepared.candleData.length - 1, matchIndex + 30);
        chart.timeScale().setVisibleLogicalRange({ from: fromIdx, to: toIdx });
        requestAnimationFrame(drawZhongshuOverlay);
        return () => {
          chart.unsubscribeCrosshairMove(handleCrosshair);
          containerEl?.removeEventListener("mouseleave", handleMouseLeave);
        };
      }
    }

    chart.timeScale().fitContent();
    requestAnimationFrame(drawZhongshuOverlay);

    return () => {
      chart.unsubscribeCrosshairMove(handleCrosshair);
      containerEl?.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [prepared, commands, focusedSignalTime, height, handleCrosshair]);

  const legendUpColor = displayed?.isUp ? "#EF4444" : "#22C55E";

  return (
    <div ref={containerRef} className={`w-full relative rounded-lg overflow-hidden ${className}`} style={{ height }}>
      {showOhlcLegend && displayed && (
        <div className="tv-ohlc-legend" aria-live="polite" aria-atomic="true">
          <span className="tv-ohlc-time tnum">{displayed.timeLabel}</span>
          <span className="tv-ohlc-sep" aria-hidden>
            |
          </span>
          <span className="tv-ohlc-item">
            O <b className="tnum">{formatPrice(displayed.open)}</b>
          </span>
          <span className="tv-ohlc-item">
            H <b className="tnum">{formatPrice(displayed.high)}</b>
          </span>
          <span className="tv-ohlc-item">
            L <b className="tnum">{formatPrice(displayed.low)}</b>
          </span>
          <span className="tv-ohlc-item">
            C{" "}
            <b className="tnum" style={{ color: legendUpColor }}>
              {formatPrice(displayed.close)}
            </b>
          </span>
          <span className="tv-ohlc-item">
            V <b className="tnum">{formatVolOrAmount(displayed.volume)}</b>
          </span>
          <span className="tv-ohlc-item">
            A <b className="tnum">{formatVolOrAmount(displayed.amount)}</b>
          </span>
        </div>
      )}
      {showOhlcLegend && !displayed && k.length === 0 && (
        <div className="tv-ohlc-legend tv-ohlc-legend--empty">
          <span>暂无 K 线数据</span>
        </div>
      )}
      <canvas ref={overlayCanvasRef} className="pointer-events-none absolute inset-0 z-10" />
    </div>
  );
}

export default TradingViewChart;
