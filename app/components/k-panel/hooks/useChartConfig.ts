import type { IFetchK } from "@/app/api/types";
import type { CustomSeriesOption } from "echarts/charts";
import * as echarts from "echarts/core";
import { useCallback, useEffect, useRef } from "react";
import { useThemeName } from "@/app/styles/ThemeProvider";
import {
  getThemeColors,
  getBiColorForTheme,
  getBiStyle,
  getChannelColorForTheme,
  hexToRgba,
  type ThemeChartColors,
} from "../config/chartColors";
import {
  DATAZOOM_CONFIG,
  GRID_CONFIG,
  LEGEND_CONFIG,
  TITLE_CONFIG,
  getTooltipConfig,
  getAxisPointerLabelBg,
} from "../config/chartOptions";
import type {
  BiMappedData,
  BspSignalMappedData,
  ChannelMappedData,
  DuanChannelMappedData,
  DuanMappedData,
  ECOption,
  FenxingMappedData,
  MacdData,
  MergeKRect,
  SubChartType,
} from "../types";
import {
  calculatePriceRange,
  formatDateArray,
  formatKlineData,
  formatKTooltip,
  formatVolumeData,
  isKTooltipParams,
} from "../utils/formatters";

interface UseChartConfigProps {
  k: IFetchK[];
  mergeKRects: MergeKRect[];
  biData: BiMappedData[];
  mergeKPlaceholders: Array<number | null>;
  biPlaceholders: Array<number | null>;
  channelData: ChannelMappedData[];
  channelPlaceholders: Array<number | null>;
  fenxingData: FenxingMappedData[];
  fenxingPlaceholders: Array<number | null>;
  duanData?: DuanMappedData[];
  duanPlaceholders?: Array<number | null>;
  duanChannelData?: DuanChannelMappedData[];
  duanChannelPlaceholders?: Array<number | null>;
  bspData?: BspSignalMappedData[];
  bspPlaceholders?: Array<number | null>;
  macdData?: MacdData;
  subChartType?: SubChartType;
  onSignalClick?: (signal: BspSignalMappedData) => void;
  focusedSignalTime?: string | null;
}

const DEFAULT_BAR_WIDTH = 20;

const getBarWidth = (sizeResult: number | number[] | undefined): number => {
  if (Array.isArray(sizeResult)) {
    return sizeResult[0] ?? DEFAULT_BAR_WIDTH;
  }
  return typeof sizeResult === "number" ? sizeResult : DEFAULT_BAR_WIDTH;
};

export function useChartConfig({
  k,
  mergeKRects,
  biData,
  mergeKPlaceholders,
  biPlaceholders,
  channelData,
  channelPlaceholders,
  fenxingData,
  fenxingPlaceholders,
  duanData = [],
  duanPlaceholders = [],
  duanChannelData = [],
  duanChannelPlaceholders = [],
  bspData = [],
  bspPlaceholders = [],
  macdData = { dif: [], dea: [], hist: [] },
  subChartType = "volume",
  onSignalClick,
  focusedSignalTime,
}: UseChartConfigProps) {
  const mergeKRectsRef = useRef<MergeKRect[]>(mergeKRects);
  const biDataRef = useRef<BiMappedData[]>(biData);
  const mergeKPlaceholdersRef =
    useRef<Array<number | null>>(mergeKPlaceholders);
  const biPlaceholdersRef = useRef<Array<number | null>>(biPlaceholders);
  const channelDataRef = useRef<ChannelMappedData[]>(channelData);
  const channelPlaceholdersRef =
    useRef<Array<number | null>>(channelPlaceholders);
  const fenxingDataRef = useRef<FenxingMappedData[]>(fenxingData);
  const fenxingPlaceholdersRef =
    useRef<Array<number | null>>(fenxingPlaceholders);

  const duanDataRef = useRef<DuanMappedData[]>(duanData);
  const duanPlaceholdersRef = useRef<Array<number | null>>(duanPlaceholders);
  const duanChannelDataRef = useRef<DuanChannelMappedData[]>(duanChannelData);
  const duanChannelPlaceholdersRef =
    useRef<Array<number | null>>(duanChannelPlaceholders);
  const bspDataRef = useRef<BspSignalMappedData[]>(bspData);
  const bspPlaceholdersRef = useRef<Array<number | null>>(bspPlaceholders);
  const macdDataRef = useRef<MacdData>(macdData);
  const onSignalClickRef = useRef(onSignalClick);

  // 当前主题（驱动 tooltip/涨跌/缠论结构色随深浅切换）
  const themeName = useThemeName();

  useEffect(() => {
    mergeKRectsRef.current = mergeKRects;
  }, [mergeKRects]);

  useEffect(() => {
    biDataRef.current = biData;
  }, [biData]);

  useEffect(() => {
    mergeKPlaceholdersRef.current = mergeKPlaceholders;
  }, [mergeKPlaceholders]);

  useEffect(() => {
    biPlaceholdersRef.current = biPlaceholders;
  }, [biPlaceholders]);

  useEffect(() => {
    channelDataRef.current = channelData;
  }, [channelData]);

  useEffect(() => {
    channelPlaceholdersRef.current = channelPlaceholders;
  }, [channelPlaceholders]);

  useEffect(() => {
    fenxingDataRef.current = fenxingData;
  }, [fenxingData]);

  useEffect(() => {
    fenxingPlaceholdersRef.current = fenxingPlaceholders;
  }, [fenxingPlaceholders]);

  useEffect(() => {
    duanDataRef.current = duanData;
  }, [duanData]);

  useEffect(() => {
    duanPlaceholdersRef.current = duanPlaceholders;
  }, [duanPlaceholders]);

  useEffect(() => {
    duanChannelDataRef.current = duanChannelData;
  }, [duanChannelData]);

  useEffect(() => {
    duanChannelPlaceholdersRef.current = duanChannelPlaceholders;
  }, [duanChannelPlaceholders]);

  useEffect(() => {
    bspDataRef.current = bspData;
  }, [bspData]);

  useEffect(() => {
    bspPlaceholdersRef.current = bspPlaceholders;
  }, [bspPlaceholders]);

  useEffect(() => {
    macdDataRef.current = macdData;
  }, [macdData]);

  useEffect(() => {
    onSignalClickRef.current = onSignalClick;
  }, [onSignalClick]);

  // 当前主题图表色
  const colors = getThemeColors(themeName);
  const colorsRef = useRef<ThemeChartColors>(colors);
  useEffect(() => {
    colorsRef.current = colors;
  }, [colors]);

  // 创建合并k线的数据
  const createMergeKSeries = useCallback((): CustomSeriesOption => {
    return {
      name: "合并K",
      type: "custom",
      renderItem: (params, api) => {
        const dataIndex = params.dataIndex;
        const placeholderValue = mergeKPlaceholdersRef.current[dataIndex];

        if (placeholderValue === null) {
          return null;
        }

        const rect = mergeKRectsRef.current.find(
          (r) => r.rectId === placeholderValue
        );

        if (!rect) {
          return null;
        }

        const startPoint = api.coord([rect.startIndex, rect.high]);
        const endPoint = api.coord([rect.endIndex, rect.low]);

        if (!startPoint || !endPoint) {
          return null;
        }

        const barWidth = getBarWidth(api.size?.([1, 0]));
        const c = colorsRef.current;
        const halfBarWidth = barWidth * 0.4;
        const x = startPoint[0] - halfBarWidth;
        const y = Math.min(startPoint[1], endPoint[1]);
        const width = endPoint[0] - startPoint[0] + barWidth * 0.8;
        const height = Math.abs(startPoint[1] - endPoint[1]);

        return {
          type: "rect",
          shape: {
            x,
            y,
            width,
            height,
          },
          style: {
            fill: rect.trend === "up" ? c.upFill : c.downFill,
            stroke: rect.trend === "up" ? c.up : c.down,
            lineWidth: 1,
            lineDash: [5, 5],
          },
          z: 5,
        };
      },
      data: mergeKPlaceholdersRef.current,
      z: 5,
    };
  }, []);

  // 创建笔的数据
  const createBiSeries = useCallback((): CustomSeriesOption => {
    return {
      name: "笔",
      type: "custom",
      renderItem: (params, api) => {
        const dataIndex = params.dataIndex;
        const placeholderValue = biPlaceholdersRef.current[dataIndex];

        if (placeholderValue === null) {
          return null;
        }

        const biItem = biDataRef.current.find(
          (b) => b.biId === placeholderValue
        );

        if (!biItem) {
          return null;
        }

        const startPoint = api.coord([biItem.startIndex, biItem.startPrice]);
        const endPoint = api.coord([biItem.endIndex, biItem.endPrice]);

        if (!startPoint || !endPoint) {
          return null;
        }

        const color = getBiColorForTheme(
          biItem.type,
          biItem.status,
          colorsRef.current
        );
        const style = getBiStyle(biItem.trend);

        return {
          type: "line",
          shape: {
            x1: startPoint[0],
            y1: startPoint[1],
            x2: endPoint[0],
            y2: endPoint[1],
          },
          style: {
            stroke: color,
            lineWidth: style.lineWidth,
            opacity: style.opacity,
            lineDash: style.lineDash,
          },
          z: 10,
        };
      },
      data: biPlaceholdersRef.current,
      z: 10,
    };
  }, []);

  // 创建中枢的数据
  const createChannelSeries = useCallback((): CustomSeriesOption => {
    return {
      name: "中枢",
      type: "custom",
      renderItem: (params, api) => {
        const dataIndex = params.dataIndex;
        const placeholderValue = channelPlaceholdersRef.current[dataIndex];

        if (placeholderValue === null) {
          return null;
        }

        const channel = channelDataRef.current.find(
          (c) => c.channelId === placeholderValue
        );

        if (!channel) {
          return null;
        }

        const startPoint = api.coord([channel.startIndex, channel.zg]);
        const endPoint = api.coord([channel.endIndex, channel.zd]);

        if (!startPoint || !endPoint) {
          return null;
        }

        const barWidth = getBarWidth(api.size?.([1, 0]));
        const halfBarWidth = barWidth * 0.4;

        const x = startPoint[0] - halfBarWidth;
        const y = startPoint[1];
        const width = endPoint[0] - startPoint[0] + barWidth * 0.8;
        const height = endPoint[1] - startPoint[1];

        const color = getChannelColorForTheme(
          channel.type,
          colorsRef.current
        );
        const fillColor = hexToRgba(
          color,
          channel.type === "complete" ? 0.20 : 0.12
        );

        const zgY = api.coord([channel.startIndex, channel.zg])?.[1];
        const zdY = api.coord([channel.startIndex, channel.zd])?.[1];
        const zgEndY = api.coord([channel.endIndex, channel.zg])?.[1];
        const zdEndY = api.coord([channel.endIndex, channel.zd])?.[1];

        if (
          zgY === undefined ||
          zdY === undefined ||
          zgEndY === undefined ||
          zdEndY === undefined
        ) {
          return null;
        }

        return {
          type: "group",
          children: [
            {
              type: "rect",
              shape: {
                x,
                y,
                width,
                height,
              },
              style: {
                fill: fillColor,
              },
              z: 3,
            },
            {
              type: "line",
              shape: {
                x1: startPoint[0] - halfBarWidth,
                y1: zgY,
                x2: endPoint[0] + halfBarWidth,
                y2: zgEndY,
              },
              style: {
                stroke: color,
                lineWidth: 2,
                lineDash: [5, 3],
                opacity: 0.8,
              },
              z: 4,
            },
            {
              type: "line",
              shape: {
                x1: startPoint[0] - halfBarWidth,
                y1: zdY,
                x2: endPoint[0] + halfBarWidth,
                y2: zdEndY,
              },
              style: {
                stroke: color,
                lineWidth: 2,
                lineDash: [5, 3],
                opacity: 0.8,
              },
              z: 4,
            },
            {
              type: "rect",
              shape: {
                x,
                y,
                width,
                height,
              },
              style: {
                fill: "transparent",
                stroke: color,
                lineWidth: 1,
                lineDash: [10, 5],
                opacity: 0.6,
              },
              z: 4,
            },
          ],
        };
      },
      data: channelPlaceholdersRef.current,
      z: 3,
      silent: false,
    };
  }, []);

  // 创建分型的数据
  const createFenxingSeries = useCallback((): CustomSeriesOption => {
    return {
      name: "分型",
      type: "custom",
      renderItem: (params, api) => {
        const dataIndex = params.dataIndex;
        const placeholderValue = fenxingPlaceholdersRef.current[dataIndex];

        if (placeholderValue === null) {
          return null;
        }

        const fenxing = fenxingDataRef.current.find(
          (f) => f.index === placeholderValue
        );

        if (!fenxing) {
          return null;
        }

        const point = api.coord([fenxing.index, fenxing.price]);

        if (!point) {
          return null;
        }

        const barWidth = getBarWidth(api.size?.([1, 0]));
        const c = colorsRef.current;
        const color =
          fenxing.type === "top" ? c.fenxingTop : c.fenxingBottom;
        const size = barWidth * 0.4;
        const halfSize = size / 2;
        const offset = barWidth * 1.5;

        if (fenxing.type === "top") {
          const yOffset = point[1] - offset;
          return {
            type: "path",
            shape: {
              pathData: `M ${point[0] - halfSize},${yOffset - halfSize}
                         L ${point[0] + halfSize},${yOffset - halfSize}
                         L ${point[0]},${yOffset + halfSize}
                         Z`,
            },
            style: {
              fill: color,
              stroke: c.fenxingStroke,
              lineWidth: 2,
            },
            z: 15,
          };
        } else {
          const yOffset = point[1] + offset;
          return {
            type: "circle",
            shape: {
              cx: point[0],
              cy: yOffset,
              r: halfSize,
            },
            style: {
              fill: color,
              stroke: c.fenxingStroke,
              lineWidth: 2,
            },
            z: 15,
          };
        }
      },
      data: fenxingPlaceholdersRef.current,
      z: 15,
    };
  }, []);

  // 创建线段的数据 (Duan)
  const createDuanSeries = useCallback((): CustomSeriesOption => {
    return {
      name: "段",
      type: "custom",
      renderItem: (params, api) => {
        const dataIndex = params.dataIndex;
        const placeholderValue = duanPlaceholdersRef.current[dataIndex];

        if (placeholderValue === null || placeholderValue === undefined) {
          return null;
        }

        const duanItem = duanDataRef.current.find(
          (d) => d.duanId === placeholderValue
        );

        if (!duanItem) {
          return null;
        }

        const startPoint = api.coord([duanItem.startIndex, duanItem.startPrice]);
        const endPoint = api.coord([duanItem.endIndex, duanItem.endPrice]);

        if (!startPoint || !endPoint) {
          return null;
        }

        const color = duanItem.trend === "up" ? "#ec4899" : "#3b82f6";

        return {
          type: "line",
          shape: {
            x1: startPoint[0],
            y1: startPoint[1],
            x2: endPoint[0],
            y2: endPoint[1],
          },
          style: {
            stroke: color,
            lineWidth: 3,
            opacity: 0.95,
          },
          z: 12,
        };
      },
      data: duanPlaceholdersRef.current,
      z: 12,
    };
  }, []);

  // 创建段中枢的数据 (DuanChannel)
  const createDuanChannelSeries = useCallback((): CustomSeriesOption => {
    return {
      name: "段中枢",
      type: "custom",
      renderItem: (params, api) => {
        const dataIndex = params.dataIndex;
        const placeholderValue =
          duanChannelPlaceholdersRef.current[dataIndex];

        if (placeholderValue === null || placeholderValue === undefined) {
          return null;
        }

        const channel = duanChannelDataRef.current.find(
          (c) => c.channelId === placeholderValue
        );

        if (!channel) {
          return null;
        }

        const startPoint = api.coord([channel.startIndex, channel.zg]);
        const endPoint = api.coord([channel.endIndex, channel.zd]);

        if (!startPoint || !endPoint) {
          return null;
        }

        const barWidth = getBarWidth(api.size?.([1, 0]));
        const halfBarWidth = barWidth * 0.4;
        const x = startPoint[0] - halfBarWidth;
        const y = startPoint[1];
        const width = endPoint[0] - startPoint[0] + barWidth * 0.8;
        const height = endPoint[1] - startPoint[1];

        const color = "#8b5cf6";
        const fillColor = hexToRgba(color, 0.25);

        return {
          type: "group",
          children: [
            {
              type: "rect",
              shape: { x, y, width, height },
              style: { fill: fillColor },
              z: 4,
            },
            {
              type: "rect",
              shape: { x, y, width, height },
              style: {
                fill: "transparent",
                stroke: color,
                lineWidth: 2,
                lineDash: [6, 4],
                opacity: 0.85,
              },
              z: 4,
            },
          ],
        };
      },
      data: duanChannelPlaceholdersRef.current,
      z: 4,
    };
  }, []);

  // 创建买卖点的数据 (BSP Pins)
  const createBspSeries = useCallback((): CustomSeriesOption => {
    return {
      name: "买卖点",
      type: "custom",
      renderItem: (params, api) => {
        const dataIndex = params.dataIndex;
        const placeholderValue = bspPlaceholdersRef.current[dataIndex];

        if (placeholderValue === null || placeholderValue === undefined) {
          return null;
        }

        const bspItem = bspDataRef.current.find(
          (b) => b.bspId === placeholderValue
        );

        if (!bspItem) {
          return null;
        }

        const point = api.coord([bspItem.index, bspItem.price]);
        if (!point) return null;

        const isBuy = bspItem.isBuy;
        const color = isBuy ? "#16a34a" : "#dc2626";
        const tagText = bspItem.label;
        const yOffset = isBuy ? 24 : -24;

        return {
          type: "group",
          children: [
            {
              type: "circle",
              shape: {
                cx: point[0],
                cy: point[1],
                r: 4,
              },
              style: {
                fill: color,
                stroke: "#ffffff",
                lineWidth: 1.5,
              },
              z: 20,
            },
            {
              type: "line",
              shape: {
                x1: point[0],
                y1: point[1],
                x2: point[0],
                y2: point[1] + yOffset,
              },
              style: {
                stroke: color,
                lineWidth: 1.5,
                lineDash: [2, 2],
              },
              z: 20,
            },
            {
              type: "rect",
              shape: {
                x: point[0] - 16,
                y: point[1] + yOffset - (isBuy ? 0 : 16),
                width: 32,
                height: 16,
                r: 3,
              },
              style: {
                fill: color,
                shadowBlur: 4,
                shadowColor: "rgba(0,0,0,0.3)",
              },
              z: 21,
            },
            {
              type: "text",
              style: {
                text: tagText,
                x: point[0],
                y: point[1] + yOffset + (isBuy ? 8 : -8),
                fill: "#ffffff",
                font: "bold 10px sans-serif",
                textAlign: "center",
                textVerticalAlign: "middle",
              },
              z: 22,
            },
          ],
        };
      },
      data: bspPlaceholdersRef.current,
      z: 20,
    };
  }, []);

  const chartInstanceRef = useRef<echarts.ECharts | null>(null);

  const setOption = useCallback(
    (chart: echarts.ECharts) => {
      if (!chart || k.length === 0) return;
      chartInstanceRef.current = chart;

      const dates = formatDateArray(k);
      const klineData = formatKlineData(k);
      const volumes = formatVolumeData(k);
      const {
        min: minPrice,
        max: maxPrice,
        range: priceRange,
      } = calculatePriceRange(k);

      const subSeries =
        subChartType === "macd"
          ? [
              {
                name: "MACD柱",
                type: "bar" as const,
                xAxisIndex: 1,
                yAxisIndex: 1,
                data: macdData.hist,
                itemStyle: {
                  color: function (params: { value?: unknown }) {
                    const val = Number(params.value ?? 0);
                    return val >= 0 ? colors.up : colors.down;
                  },
                },
              },
              {
                name: "DIF",
                type: "line" as const,
                xAxisIndex: 1,
                yAxisIndex: 1,
                data: macdData.dif,
                showSymbol: false,
                lineStyle: { width: 1.5, color: "#f59e0b" },
              },
              {
                name: "DEA",
                type: "line" as const,
                xAxisIndex: 1,
                yAxisIndex: 1,
                data: macdData.dea,
                showSymbol: false,
                lineStyle: { width: 1.5, color: "#6366f1" },
              },
            ]
          : [
              {
                name: "成交量",
                type: "bar" as const,
                xAxisIndex: 1,
                yAxisIndex: 1,
                data: volumes,
                itemStyle: {
                  color: function (params: { dataIndex: number }) {
                    const dataIndex = params.dataIndex;
                    const kline = klineData[dataIndex];
                    if (!kline) return colors.down;
                    return kline[1] > kline[0] ? colors.up : colors.down;
                  },
                },
              },
            ];

      const options: ECOption = {
        title: TITLE_CONFIG,
        legend: {
          ...LEGEND_CONFIG,
          data: [
            "K线",
            "中枢",
            "合并K",
            "笔",
            "分型",
            "段",
            "段中枢",
            "买卖点",
            ...(subChartType === "macd"
              ? ["MACD柱", "DIF", "DEA"]
              : ["成交量"]),
          ],
        },
        tooltip: {
          ...getTooltipConfig(themeName),
          formatter: function (params: unknown) {
            const paramsArray = isKTooltipParams(params) ? params : [];
            return formatKTooltip(paramsArray, k, dates);
          },
        },
        axisPointer: {
          link: [{ xAxisIndex: "all" }],
          label: { backgroundColor: getAxisPointerLabelBg(themeName) },
        },
        grid: GRID_CONFIG,
        xAxis: [
          {
            type: "category",
            data: dates,
            boundaryGap: true,
            axisLine: { onZero: false },
            splitLine: { show: false },
            min: "dataMin",
            max: "dataMax",
          },
          {
            type: "category",
            gridIndex: 1,
            data: dates,
            boundaryGap: true,
            axisLine: { onZero: false },
            axisTick: { show: false },
            splitLine: { show: false },
            axisLabel: { show: false },
            min: "dataMin",
            max: "dataMax",
          },
        ],
        yAxis: [
          {
            scale: true,
            min: Math.max(0, minPrice - priceRange * 0.05),
            max: maxPrice + priceRange * 0.05,
            splitArea: {
              show: true,
            },
          },
          {
            scale: true,
            gridIndex: 1,
            splitNumber: 2,
            axisLabel: { show: false },
            axisLine: { show: false },
            axisTick: { show: false },
            splitLine: { show: false },
          },
        ],
        dataZoom: DATAZOOM_CONFIG,
        series: [
          {
            name: "K线",
            type: "candlestick",
            data: klineData,
            itemStyle: {
              color: colors.up,
              color0: colors.down,
              borderColor: colors.up,
              borderColor0: colors.down,
            },
          },
          createChannelSeries(),
          createMergeKSeries(),
          createBiSeries(),
          createFenxingSeries(),
          createDuanSeries(),
          createDuanChannelSeries(),
          createBspSeries(),
          ...subSeries,
        ],
      };

      chart.setOption(options, true);

      // 绑定点击事件，支持点击买卖点触发诊断回调
      chart.off("click");
      chart.on("click", (params) => {
        if (params.seriesName === "买卖点") {
          const placeholderValue =
            bspPlaceholdersRef.current[params.dataIndex];
          if (placeholderValue !== null && placeholderValue !== undefined) {
            const bsp = bspDataRef.current.find(
              (b) => b.bspId === placeholderValue
            );
            if (bsp && onSignalClickRef.current) {
              onSignalClickRef.current(bsp);
            }
          }
        }
      });
    },
    [
      k,
      createMergeKSeries,
      createChannelSeries,
      createBiSeries,
      createFenxingSeries,
      createDuanSeries,
      createDuanChannelSeries,
      createBspSeries,
      subChartType,
      macdData,
      themeName,
      colors,
    ]
  );

  // 当 focusedSignalTime 发生变化时，平滑居中聚焦
  useEffect(() => {
    if (!focusedSignalTime || k.length === 0 || !chartInstanceRef.current) return;
    const targetMs = new Date(focusedSignalTime).getTime();
    let targetIndex = -1;
    for (let i = 0; i < k.length; i++) {
      if (new Date(k[i].time).getTime() >= targetMs) {
        targetIndex = i;
        break;
      }
    }
    if (targetIndex === -1 && k.length > 0) targetIndex = k.length - 1;
    // zoom window
    const windowHalf = 25;
    const startIdx = Math.max(0, targetIndex - windowHalf);
    const endIdx = Math.min(k.length - 1, targetIndex + windowHalf);
    const start = (startIdx / k.length) * 100;
    const end = (endIdx / k.length) * 100;

    chartInstanceRef.current.dispatchAction({
      type: "dataZoom",
      start,
      end,
    });
  }, [focusedSignalTime, k]);

  return { setOption };
}

