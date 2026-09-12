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
  formatShanghaiSmartTime,
  formatShanghaiTime,
  getShanghaiDateParts,
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

export interface ChanSwing {
  id: string;
  type: "bi" | "duan";
  startTime: string;
  endTime: string;
  startPrice: number;
  endPrice: number;
  isUp: boolean;
  high: number;
  low: number;
  diff: number;
}

interface FibStyle {
  color: string;
  fill?: string;
  lineStyle: "solid" | "dashed";
}

const TRADINGVIEW_FIB_STYLES: Record<string, FibStyle> = {
  "0": { color: "#787B86", lineStyle: "solid" },
  "0.236": { color: "#F23645", fill: "rgba(242, 54, 69, 0.08)", lineStyle: "dashed" },
  "0.382": { color: "#FF9800", fill: "rgba(255, 152, 0, 0.08)", lineStyle: "dashed" },
  "0.5": { color: "#4CAF50", fill: "rgba(76, 175, 80, 0.08)", lineStyle: "dashed" },
  "0.618": { color: "#089981", fill: "rgba(8, 153, 129, 0.14)", lineStyle: "dashed" },
  "0.786": { color: "#2962FF", fill: "rgba(41, 98, 255, 0.08)", lineStyle: "dashed" },
  "1": { color: "#787B86", fill: "rgba(120, 123, 134, 0.08)", lineStyle: "solid" },
};

const FIB_BAND_PAIRS = [
  { upper: "0.236", lower: "0.382" },
  { upper: "0.382", lower: "0.5" },
  { upper: "0.5", lower: "0.618" },
  { upper: "0.618", lower: "0.786" },
  { upper: "0.786", lower: "1" },
];

function distanceToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): { distance: number; projX: number; projY: number } {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    return { distance: Math.hypot(px - x1, py - y1), projX: x1, projY: y1 };
  }
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return { distance: Math.hypot(px - projX, py - projY), projX, projY };
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
    const timeLabel = formatShanghaiSmartTime(item.time as string | number | Date);
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
  biColor,
  biWidth,
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

    const initialWidth =
      containerRef.current.clientWidth ||
      containerRef.current.offsetWidth ||
      800;

    const chart = createChart(containerRef.current, {
      width: initialWidth,
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
          return formatShanghaiSmartTime(timestamp * 1000);
        },
      },
      timeScale: {
        borderColor: gridColor,
        timeVisible: true,
        secondsVisible: false,
        tickMarkFormatter: (timestamp: number) => {
          const d = new Date(timestamp * 1000);
          const parts = getShanghaiDateParts(d);
          if (parts.hour === 0 && parts.minute === 0 && parts.second === 0) {
            return `${parts.month}/${parts.day}`;
          }
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
        const w = containerRef.current.clientWidth;
        if (w > 0) {
          chartRef.current.applyOptions({ width: w });
        }
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(containerRef.current);

    const rafId = requestAnimationFrame(() => {
      handleResize();
    });

    const strokeSeries = strokeSeriesRef.current;
    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      strokeSeries.clear();
    };
  }, [isDark, height, subChartType]);

  const [selectedSwing, setSelectedSwing] = useState<ChanSwing | null>(null);
  const selectedSwingRef = useRef<ChanSwing | null>(null);

  const [hoveredSwing, setHoveredSwing] = useState<ChanSwing | null>(null);
  const hoveredSwingRef = useRef<ChanSwing | null>(null);

  const hoverProjRef = useRef<{ x: number; y: number } | null>(null);
  const drawZhongshuOverlayRef = useRef<(() => void) | null>(null);

  const swings = useMemo<ChanSwing[]>(() => {
    if (!commands || commands.length === 0) return [];
    const list: ChanSwing[] = [];
    for (const cmd of commands) {
      if (
        cmd.type === "line" &&
        cmd.startTime &&
        cmd.endTime &&
        cmd.startPrice !== undefined &&
        cmd.endPrice !== undefined
      ) {
        const sp = Number(cmd.startPrice);
        const ep = Number(cmd.endPrice);
        if (Number.isFinite(sp) && Number.isFinite(ep)) {
          const isUp = ep >= sp;
          const high = Math.max(sp, ep);
          const low = Math.min(sp, ep);
          const diff = high - low;
          list.push({
            id: cmd.id || `${cmd.layer || "bi"}_${cmd.startTime}_${cmd.endTime}`,
            type: cmd.layer === "chan_duan" ? "duan" : "bi",
            startTime: cmd.startTime,
            endTime: cmd.endTime,
            startPrice: sp,
            endPrice: ep,
            isUp,
            high,
            low,
            diff,
          });
        }
      }
    }
    return list;
  }, [commands]);

  const swingsRef = useRef<ChanSwing[]>([]);

  const [prevCommands, setPrevCommands] = useState(commands);
  if (commands !== prevCommands) {
    setPrevCommands(commands);
    setSelectedSwing(null);
    setHoveredSwing(null);
  }

  useEffect(() => {
    selectedSwingRef.current = selectedSwing;
    hoveredSwingRef.current = hoveredSwing;
    swingsRef.current = swings;
    drawZhongshuOverlayRef.current?.();
  }, [selectedSwing, hoveredSwing, swings]);

  const findNearestSwing = useCallback(
    (px: number, py: number): { swing: ChanSwing; projX: number; projY: number } | null => {
      const chart = chartRef.current;
      const candleSeries = candleSeriesRef.current;
      const container = containerRef.current;
      if (!chart || !candleSeries || !container) return null;

      const width = container.clientWidth;
      const timeScale = chart.timeScale();
      const visibleRange = timeScale.getVisibleRange();

      let bestMatch: { swing: ChanSwing; projX: number; projY: number } | null = null;
      let minDistance = 14;

      for (const swing of swingsRef.current) {
        const t1 = toUTCTimestamp(swing.startTime);
        const t2 = toUTCTimestamp(swing.endTime);

        if (visibleRange) {
          if ((t2 as number) < (visibleRange.from as number) || (t1 as number) > (visibleRange.to as number)) {
            continue;
          }
        }

        let x1 = timeScale.timeToCoordinate(t1);
        let x2 = timeScale.timeToCoordinate(t2);

        if (visibleRange) {
          if (x1 === null && (t1 as number) <= (visibleRange.from as number)) {
            x1 = 0 as unknown as import("lightweight-charts").Coordinate;
          }
          if (x2 === null && (t2 as number) >= (visibleRange.to as number)) {
            x2 = width as unknown as import("lightweight-charts").Coordinate;
          }
        }

        const y1 = candleSeries.priceToCoordinate(swing.startPrice);
        const y2 = candleSeries.priceToCoordinate(swing.endPrice);

        if (x1 === null || x2 === null || y1 === null || y2 === null) continue;

        const hit = distanceToSegment(px, py, Number(x1), Number(y1), Number(x2), Number(y2));
        if (hit.distance < minDistance) {
          minDistance = hit.distance;
          bestMatch = { swing, projX: hit.projX, projY: hit.projY };
        }
      }

      return bestMatch;
    },
    []
  );

  const handleCrosshair = useCallback(
    (param: MouseEventParams) => {
      if (
        !param ||
        param.point === undefined ||
        !param.time ||
        param.logical === undefined
      ) {
        setHovered(null);
        if (hoveredSwingRef.current !== null) {
          hoveredSwingRef.current = null;
          hoverProjRef.current = null;
          setHoveredSwing(null);
          if (containerRef.current) containerRef.current.style.cursor = "default";
          drawZhongshuOverlayRef.current?.();
        }
        return;
      }
      const t = param.time as unknown as number;
      const hit = prepared.map.get(t);
      if (hit) {
        setHovered(hit);
      } else {
        const candleSeries = candleSeriesRef.current;
        if (candleSeries) {
          const seriesData = param.seriesData?.get(candleSeries) as CandlestickData | undefined;
          if (seriesData && seriesData.time !== undefined) {
            const t2 = seriesData.time as unknown as number;
            const hit2 = prepared.map.get(t2);
            if (hit2) {
              setHovered(hit2);
            } else {
              setHovered(null);
            }
          } else {
            setHovered(null);
          }
        } else {
          setHovered(null);
        }
      }

      // Magnetic snap check for Bi / Duan lines
      const hitSwing = param.point ? findNearestSwing(param.point.x, param.point.y) : null;
      if (hitSwing) {
        if (hoveredSwingRef.current?.id !== hitSwing.swing.id) {
          hoveredSwingRef.current = hitSwing.swing;
          hoverProjRef.current = { x: hitSwing.projX, y: hitSwing.projY };
          setHoveredSwing(hitSwing.swing);
          if (containerRef.current) containerRef.current.style.cursor = "pointer";
          drawZhongshuOverlayRef.current?.();
        } else {
          hoverProjRef.current = { x: hitSwing.projX, y: hitSwing.projY };
        }
      } else {
        if (hoveredSwingRef.current !== null) {
          hoveredSwingRef.current = null;
          hoverProjRef.current = null;
          setHoveredSwing(null);
          if (containerRef.current) containerRef.current.style.cursor = "default";
          drawZhongshuOverlayRef.current?.();
        }
      }
    },
    [prepared, findNearestSwing]
  );

  const handleClick = useCallback(
    (param: MouseEventParams) => {
      if (!param.point) return;
      const hit = findNearestSwing(param.point.x, param.point.y);
      if (hit) {
        if (selectedSwingRef.current?.id === hit.swing.id) {
          selectedSwingRef.current = null;
          setSelectedSwing(null);
        } else {
          selectedSwingRef.current = hit.swing;
          setSelectedSwing(hit.swing);
        }
        drawZhongshuOverlayRef.current?.();
      }
    },
    [findNearestSwing]
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
    chart.subscribeClick(handleClick);
    const containerEl = containerRef.current;
    const handleMouseLeave = () => {
      setHovered(null);
      if (hoveredSwingRef.current !== null) {
        hoveredSwingRef.current = null;
        hoverProjRef.current = null;
        setHoveredSwing(null);
        if (containerRef.current) containerRef.current.style.cursor = "default";
        drawZhongshuOverlayRef.current?.();
      }
    };
    containerEl?.addEventListener("mouseleave", handleMouseLeave);

    if (!commands || commands.length === 0) {
      chart.timeScale().fitContent();
      return () => {
        chart.unsubscribeCrosshairMove(handleCrosshair);
        chart.unsubscribeClick(handleClick);
        containerEl?.removeEventListener("mouseleave", handleMouseLeave);
      };
    }

    const markers: SeriesMarker<UTCTimestamp>[] = [];
    const biLines: VisualCommandVo[] = [];
    const duanLines: VisualCommandVo[] = [];
    const zsBands: VisualCommandVo[] = [];
    const fibBands: VisualCommandVo[] = [];
    const fibLines: VisualCommandVo[] = [];
    const fibTexts: VisualCommandVo[] = [];

    for (const cmd of commands) {
      if (cmd.layer === "fibonacci") {
        if (cmd.type === "band") fibBands.push(cmd);
        else if (cmd.type === "line") fibLines.push(cmd);
        else if (cmd.type === "text") fibTexts.push(cmd);
      } else if (cmd.type === "line") {
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
      const strokeColor = biColor || biLines[0]?.color || "#FACC15";
      const strokeWidth = (biWidth || biLines[0]?.width || 1) as 1 | 2 | 3 | 4;
      const biSeries = chart.addLineSeries({
        color: strokeColor,
        lineWidth: strokeWidth,
        title: "笔",
        crosshairMarkerVisible: false,
      });
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
      drawZhongshuOverlayRef.current = drawZhongshuOverlay;
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
      const visibleRange = currentChart.timeScale().getVisibleRange();

      const curHover = hoveredSwingRef.current;
      const curSelected = selectedSwingRef.current;

      // 1. Render Fibonacci Translucent Bands & Level Lines
      if (curSelected && curSelected.diff > 0) {
        const { high, low, diff, isUp } = curSelected;
        const ratios = ["0", "0.236", "0.382", "0.5", "0.618", "0.786", "1"] as const;
        const levelPrices: Record<string, number> = {};
        for (const rStr of ratios) {
          const r = Number(rStr);
          levelPrices[rStr] = isUp ? high - diff * r : low + diff * r;
        }

        const tStart = toUTCTimestamp(curSelected.startTime);
        const tEnd = toUTCTimestamp(curSelected.endTime);
        let xStart = currentChart.timeScale().timeToCoordinate(tStart);
        let xEnd = currentChart.timeScale().timeToCoordinate(tEnd);

        if (visibleRange) {
          if (xStart === null && (tStart as number) <= (visibleRange.from as number)) {
            xStart = 0 as unknown as import("lightweight-charts").Coordinate;
          }
          if (xEnd === null && (tEnd as number) >= (visibleRange.to as number)) {
            xEnd = width as unknown as import("lightweight-charts").Coordinate;
          }
        }

        const xLeft = xStart !== null && xEnd !== null ? Math.min(Number(xStart), Number(xEnd)) : 0;
        const xRight = width;

        // 1.1 Render Translucent Bands between ratios
        for (const pair of FIB_BAND_PAIRS) {
          const topPrice = Math.max(levelPrices[pair.upper], levelPrices[pair.lower]);
          const bottomPrice = Math.min(levelPrices[pair.upper], levelPrices[pair.lower]);
          const style = TRADINGVIEW_FIB_STYLES[pair.lower];
          if (topPrice !== undefined && bottomPrice !== undefined && style?.fill) {
            const yTop = currentCandle.priceToCoordinate(topPrice);
            const yBottom = currentCandle.priceToCoordinate(bottomPrice);
            if (yTop !== null && yBottom !== null) {
              const yUpper = Math.min(yTop, yBottom);
              const yLower = Math.max(yTop, yBottom);
              ctx.fillStyle = style.fill;
              ctx.fillRect(xLeft, yUpper, Math.max(2, xRight - xLeft), Math.max(1, yLower - yUpper));
            }
          }
        }

        // 1.2 Render Horizontal Lines & Right Labels
        for (const rStr of ratios) {
          const price = levelPrices[rStr];
          const style = TRADINGVIEW_FIB_STYLES[rStr];
          const y = currentCandle.priceToCoordinate(price);
          if (y !== null) {
            ctx.beginPath();
            ctx.strokeStyle = style?.color || "#787B86";
            ctx.lineWidth = rStr === "0.618" ? 1.5 : 1;
            ctx.setLineDash(style?.lineStyle === "dashed" ? [4, 4] : []);
            ctx.moveTo(xLeft, y);
            ctx.lineTo(xRight, y);
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.fillStyle = style?.color || (isDark ? "#A0A0A0" : "#434343");
            ctx.font = rStr === "0.618" ? "bold 10px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" : "10px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
            ctx.textAlign = "right";
            const tagText = rStr === "0.618" ? `★ 0.618 (${price.toFixed(2)})` : `${rStr} (${price.toFixed(2)})`;
            ctx.fillText(tagText, xRight - 8, y - 3);
            ctx.textAlign = "left";
          }
        }
      } else {
        // Fallback to static commands from backend if no swing selected
        for (const band of fibBands) {
          if (!band.fromTime || !band.toTime || band.top === undefined || band.bottom === undefined) continue;
          const t1 = toUTCTimestamp(band.fromTime);
          const t2 = toUTCTimestamp(band.toTime);
          const top = Number(band.top);
          const bottom = Number(band.bottom);
          if (!Number.isFinite(top) || !Number.isFinite(bottom)) continue;

          let x1 = currentChart.timeScale().timeToCoordinate(t1);
          let x2 = currentChart.timeScale().timeToCoordinate(t2);
          if (visibleRange) {
            if (x1 === null) x1 = 0 as unknown as import("lightweight-charts").Coordinate;
            if (x2 === null) x2 = width as unknown as import("lightweight-charts").Coordinate;
          }
          const yTop = currentCandle.priceToCoordinate(top);
          const yBottom = currentCandle.priceToCoordinate(bottom);
          if (x1 !== null && x2 !== null && yTop !== null && yBottom !== null) {
            const xLeft = Math.min(x1, x2);
            const xRight = Math.max(x1, x2);
            const yUpper = Math.min(yTop, yBottom);
            const yLower = Math.max(yTop, yBottom);
            ctx.fillStyle = band.color || "rgba(8, 153, 129, 0.10)";
            ctx.fillRect(xLeft, yUpper, Math.max(2, xRight - xLeft), Math.max(1, yLower - yUpper));
          }
        }

        for (const line of fibLines) {
          if (!line.startTime || !line.endTime || line.startPrice === undefined) continue;
          const t1 = toUTCTimestamp(line.startTime);
          const t2 = toUTCTimestamp(line.endTime);
          const price = Number(line.startPrice);
          if (!Number.isFinite(price)) continue;

          let x1 = currentChart.timeScale().timeToCoordinate(t1);
          let x2 = currentChart.timeScale().timeToCoordinate(t2);
          if (visibleRange) {
            if (x1 === null) x1 = 0 as unknown as import("lightweight-charts").Coordinate;
            if (x2 === null) x2 = width as unknown as import("lightweight-charts").Coordinate;
          }
          const y = currentCandle.priceToCoordinate(price);
          if (x1 !== null && x2 !== null && y !== null) {
            ctx.beginPath();
            ctx.strokeStyle = line.color || "#787B86";
            ctx.lineWidth = line.width || 1;
            ctx.setLineDash(line.style === "dashed" ? [4, 4] : []);
            ctx.moveTo(Math.min(x1, x2), y);
            ctx.lineTo(Math.max(x1, x2), y);
            ctx.stroke();
            ctx.setLineDash([]);
          }
        }

        for (const txt of fibTexts) {
          if (!txt.time || txt.price === undefined || !txt.text) continue;
          const price = Number(txt.price);
          const t = toUTCTimestamp(txt.time);
          let x = currentChart.timeScale().timeToCoordinate(t);
          if (visibleRange && x === null) {
            x = width as unknown as import("lightweight-charts").Coordinate;
          }
          const y = currentCandle.priceToCoordinate(price);
          if (x !== null && y !== null) {
            ctx.fillStyle = txt.color || (isDark ? "#A0A0A0" : "#434343");
            ctx.font = "10px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
            ctx.textAlign = "right";
            ctx.fillText(txt.text, Number(x) - 6, y - 3);
            ctx.textAlign = "left";
          }
        }
      }

      // 2. Render Chan Zhongshu Boxes
      for (const band of zsBands) {
        if (!band.fromTime || !band.toTime || band.top === undefined || band.bottom === undefined) continue;
        const t1 = toUTCTimestamp(band.fromTime);
        const t2 = toUTCTimestamp(band.toTime);
        const top = Number(band.top);
        const bottom = Number(band.bottom);
        if (!Number.isFinite(top) || !Number.isFinite(bottom) || t2 <= t1) continue;

        let x1 = currentChart.timeScale().timeToCoordinate(t1);
        let x2 = currentChart.timeScale().timeToCoordinate(t2);

        if (visibleRange) {
          if ((t2 as number) < (visibleRange.from as number) || (t1 as number) > (visibleRange.to as number)) {
            continue;
          }
          if (x1 === null && (t1 as number) <= (visibleRange.from as number)) {
            x1 = 0 as unknown as import("lightweight-charts").Coordinate;
          }
          if (x2 === null && (t2 as number) >= (visibleRange.to as number)) {
            x2 = width as unknown as import("lightweight-charts").Coordinate;
          }
        }

        const yTop = currentCandle.priceToCoordinate(top);
        const yBottom = currentCandle.priceToCoordinate(bottom);
        if (x1 !== null && x2 !== null && yTop !== null && yBottom !== null) {
          const xLeft = Math.min(x1, x2);
          const xRight = Math.max(x1, x2);
          const yUpper = Math.min(yTop, yBottom);
          const yLower = Math.max(yTop, yBottom);
          const boxW = Math.max(4, xRight - xLeft);
          const boxH = Math.max(2, yLower - yUpper);
          const isDuan = band.layer === "chan_zs_duan";
          const isUncomplete = band.status === "uncomplete" || band.style === "dashed";
          const strokeColor = isDuan ? "#818CF8" : "#38BDF8";
          const fillColor = isDuan ? "rgba(129, 140, 248, 0.20)" : "rgba(56, 189, 248, 0.20)";
          ctx.fillStyle = fillColor;
          ctx.fillRect(xLeft, yUpper, boxW, boxH);
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = isDuan ? 2 : 1.5;
          ctx.setLineDash(isUncomplete ? [6, 3] : (isDuan ? [] : [4, 2]));
          ctx.strokeRect(xLeft, yUpper, boxW, boxH);
          ctx.setLineDash([]);
          ctx.fillStyle = strokeColor;
          ctx.font = "bold 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
          const baseLabel = isDuan ? "段中枢" : "笔中枢";
          const label = isUncomplete ? `${baseLabel}(进行中)` : baseLabel;
          const textY = yUpper - 4 > 12 ? yUpper - 4 : yUpper + 14;
          ctx.fillText(`${label} [${bottom.toFixed(2)} - ${top.toFixed(2)}]`, xLeft + 4, textY);
        }
      }

      // 3. Render Selected Swing Anchor & Highlight
      if (curSelected) {
        const t1 = toUTCTimestamp(curSelected.startTime);
        const t2 = toUTCTimestamp(curSelected.endTime);
        let x1 = currentChart.timeScale().timeToCoordinate(t1);
        let x2 = currentChart.timeScale().timeToCoordinate(t2);
        if (visibleRange) {
          if (x1 === null && (t1 as number) <= (visibleRange.from as number)) {
            x1 = 0 as unknown as import("lightweight-charts").Coordinate;
          }
          if (x2 === null && (t2 as number) >= (visibleRange.to as number)) {
            x2 = width as unknown as import("lightweight-charts").Coordinate;
          }
        }
        const y1 = currentCandle.priceToCoordinate(curSelected.startPrice);
        const y2 = currentCandle.priceToCoordinate(curSelected.endPrice);
        if (x1 !== null && x2 !== null && y1 !== null && y2 !== null) {
          ctx.save();
          // Halo glow
          ctx.beginPath();
          ctx.strokeStyle = "rgba(14, 165, 233, 0.45)";
          ctx.lineWidth = 7;
          ctx.moveTo(Number(x1), y1);
          ctx.lineTo(Number(x2), y2);
          ctx.stroke();

          // Foreground line
          ctx.beginPath();
          ctx.strokeStyle = "#0284C7";
          ctx.lineWidth = 2.5;
          ctx.moveTo(Number(x1), y1);
          ctx.lineTo(Number(x2), y2);
          ctx.stroke();

          // Endpoint circles
          ctx.fillStyle = "#38BDF8";
          ctx.beginPath();
          ctx.arc(Number(x1), y1, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(Number(x2), y2, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      // 4. Render Hovered Swing Glow & Floating Tooltip Pill
      if (curHover && curHover.id !== curSelected?.id) {
        const t1 = toUTCTimestamp(curHover.startTime);
        const t2 = toUTCTimestamp(curHover.endTime);
        let x1 = currentChart.timeScale().timeToCoordinate(t1);
        let x2 = currentChart.timeScale().timeToCoordinate(t2);
        if (visibleRange) {
          if (x1 === null && (t1 as number) <= (visibleRange.from as number)) {
            x1 = 0 as unknown as import("lightweight-charts").Coordinate;
          }
          if (x2 === null && (t2 as number) >= (visibleRange.to as number)) {
            x2 = width as unknown as import("lightweight-charts").Coordinate;
          }
        }
        const y1 = currentCandle.priceToCoordinate(curHover.startPrice);
        const y2 = currentCandle.priceToCoordinate(curHover.endPrice);
        if (x1 !== null && x2 !== null && y1 !== null && y2 !== null) {
          ctx.save();
          // Golden glow line
          ctx.beginPath();
          ctx.strokeStyle = "rgba(250, 204, 21, 0.45)";
          ctx.lineWidth = 6;
          ctx.moveTo(Number(x1), y1);
          ctx.lineTo(Number(x2), y2);
          ctx.stroke();

          ctx.beginPath();
          ctx.strokeStyle = "#FACC15";
          ctx.lineWidth = 2.5;
          ctx.moveTo(Number(x1), y1);
          ctx.lineTo(Number(x2), y2);
          ctx.stroke();
          ctx.restore();

          // Floating Tooltip Capsule
          const proj = hoverProjRef.current;
          if (proj) {
            const pillText = `📐 ${curHover.type === "duan" ? "线段" : "笔"} [${curHover.low.toFixed(2)} - ${curHover.high.toFixed(2)}] 点击吸附斐波那契`;
            ctx.font = "bold 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
            const metrics = ctx.measureText(pillText);
            const pillW = metrics.width + 18;
            const pillH = 22;
            const pillX = Math.max(8, Math.min(width - pillW - 8, proj.x - pillW / 2));
            const pillY = Math.max(28, proj.y - 30);

            ctx.save();
            ctx.fillStyle = isDark ? "rgba(24, 24, 27, 0.94)" : "rgba(255, 255, 255, 0.96)";
            ctx.strokeStyle = "#FACC15";
            ctx.lineWidth = 1;
            ctx.beginPath();
            if (typeof ctx.roundRect === "function") {
              ctx.roundRect(pillX, pillY, pillW, pillH, 4);
            } else {
              ctx.rect(pillX, pillY, pillW, pillH);
            }
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = isDark ? "#FACC15" : "#B45309";
            ctx.textAlign = "left";
            ctx.fillText(pillText, pillX + 9, pillY + 15);
            ctx.restore();
          }
        }
      }
    };

    requestAnimationFrame(drawZhongshuOverlay);
    const overlayTimer1 = setTimeout(drawZhongshuOverlay, 50);
    const overlayTimer2 = setTimeout(drawZhongshuOverlay, 200);

    chart.timeScale().subscribeVisibleLogicalRangeChange(drawZhongshuOverlay);
    chart.timeScale().subscribeVisibleTimeRangeChange(drawZhongshuOverlay);

    if (markers.length > 0) {
      markers.sort((a, b) => (a.time as number) - (b.time as number));
      candleSeries.setMarkers(markers);
    }

    let didFocus = false;
    if (focusedSignalTime) {
      const focusTimestamp = toUTCTimestamp(focusedSignalTime);
      const matchIndex = prepared.candleData.findIndex((d) => d.time === focusTimestamp);
      if (matchIndex >= 0) {
        const fromIdx = Math.max(0, matchIndex - 30);
        const toIdx = Math.min(prepared.candleData.length - 1, matchIndex + 30);
        chart.timeScale().setVisibleLogicalRange({ from: fromIdx, to: toIdx });
        didFocus = true;
      }
    }

    if (!didFocus) {
      chart.timeScale().fitContent();
    }
    requestAnimationFrame(drawZhongshuOverlay);

    return () => {
      clearTimeout(overlayTimer1);
      clearTimeout(overlayTimer2);
      drawZhongshuOverlayRef.current = null;
      chart.unsubscribeCrosshairMove(handleCrosshair);
      chart.unsubscribeClick(handleClick);
      containerEl?.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [prepared, commands, focusedSignalTime, height, handleCrosshair, handleClick, biColor, biWidth, isDark]);

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
      {selectedSwing && (
        <div
          className="absolute top-10 right-4 z-20 flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium backdrop-blur-md border shadow-md transition-all bg-white/90 dark:bg-zinc-900/90 border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200"
          style={{ pointerEvents: "auto" }}
        >
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>
            斐波那契基准: <b>{selectedSwing.type === "duan" ? "线段" : "笔"}</b>{" "}
            <span className="font-mono text-emerald-600 dark:text-emerald-400">
              {selectedSwing.low.toFixed(2)} → {selectedSwing.high.toFixed(2)}
            </span>{" "}
            ({selectedSwing.isUp ? "上涨" : "下跌"})
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              selectedSwingRef.current = null;
              setSelectedSwing(null);
            }}
            className="ml-1.5 px-2 py-0.5 rounded bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer"
            title="清除斐波那契"
          >
            ✕ 清除
          </button>
        </div>
      )}
      <canvas ref={overlayCanvasRef} className="pointer-events-none absolute inset-0 z-10" />
    </div>
  );
}

export default TradingViewChart;
