import type { IFetchK } from "@/app/api/fetch";
import type {
  BarSeriesOption,
  CandlestickSeriesOption,
  CustomSeriesOption,
} from "echarts/charts";
import type {
  DatasetComponentOption,
  DataZoomComponentOption,
  GridComponentOption,
  LegendComponentOption,
  TitleComponentOption,
  TooltipComponentOption,
} from "echarts/components";
import type { ComposeOption } from "echarts/core";
import * as echarts from "echarts/core";
import { useCallback, useEffect, useRef } from "react";
import {
  COLORS,
  getBiColor,
  getBiStyle,
  getChannelColor,
  hexToRgba,
} from "../config/chartColors";
import {
  DATAZOOM_CONFIG,
  GRID_CONFIG,
  LEGEND_CONFIG,
  TITLE_CONFIG,
  TOOLTIP_CONFIG,
} from "../config/chartOptions";
import type {
  BiMappedData,
  ChannelMappedData,
  FenxingMappedData,
  MergeKRect,
} from "../types";
import {
  calculatePriceRange,
  formatDateArray,
  formatKlineData,
  formatKTooltip,
  formatVolumeData,
} from "../utils/formatters";

type ECOption = ComposeOption<
  | CandlestickSeriesOption
  | BarSeriesOption
  | CustomSeriesOption
  | TitleComponentOption
  | LegendComponentOption
  | TooltipComponentOption
  | GridComponentOption
  | DatasetComponentOption
  | DataZoomComponentOption
>;

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
}

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

  // Update refs using useEffect to avoid accessing refs during render
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

  // 创建合并k线的数据
  const createMergeKSeries = useCallback((): CustomSeriesOption => {
    return {
      name: "mergeK",
      type: "custom",
      renderItem: (params, api) => {
        const dataIndex = params.dataIndex;
        const placeholderValue = mergeKPlaceholdersRef.current[dataIndex];

        // 如果这个位置没有矩形占位符，跳过
        if (placeholderValue === null) {
          return null;
        }

        // 根据占位符值找到对应的矩形
        const rect = mergeKRectsRef.current.find(
          (r) => r.rectId === placeholderValue
        );

        if (!rect) {
          return null;
        }

        // 获取起始和结束位置的坐标
        const startPoint = api.coord([rect.startIndex, rect.highest]);
        const endPoint = api.coord([rect.endIndex, rect.lowest]);

        // 检查坐标是否有效
        if (!startPoint || !endPoint) {
          return null;
        }

        // 获取 K 线柱子的宽度信息
        const sizeResult = api.size?.([1, 0]) || [20, 0];
        const barWidth = Array.isArray(sizeResult) ? sizeResult[0] : sizeResult;

        const halfBarWidth = barWidth * 0.4;
        // 计算矩形的位置和大小
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
            fill: rect.trend === "up" ? COLORS.upFill : COLORS.downFill,
            stroke: rect.trend === "up" ? COLORS.up : COLORS.down,
            lineWidth: 1,
            lineDash: [5, 5],
          },
          z: 5,
        };
      },
      // 数据长度与K线数据对齐，使用占位符数组
      data: mergeKPlaceholdersRef.current,
      z: 5,
    };
  }, []);

  // 创建笔的数据
  const createBiSeries = useCallback((): CustomSeriesOption => {
    return {
      name: "bi",
      type: "custom",
      renderItem: (params, api) => {
        const dataIndex = params.dataIndex;
        const placeholderValue = biPlaceholdersRef.current[dataIndex];

        // 如果这个位置没有笔占位符，跳过
        if (placeholderValue === null) {
          return null;
        }

        // 根据占位符值找到对应的笔
        const biItem = biDataRef.current.find(
          (b) => b.biId === placeholderValue
        );

        if (!biItem) {
          return null;
        }

        const startPoint = api.coord([biItem.startIndex, biItem.startPrice]);
        const endPoint = api.coord([biItem.endIndex, biItem.endPrice]);

        // 检查坐标是否有效
        if (!startPoint || !endPoint) {
          return null;
        }

        const color = getBiColor(biItem.type, biItem.status);
        const style = getBiStyle(biItem.trend);

        // 调试日志：打印笔的详细信息，包括起点和终点价格
        console.log(`Rendering bi ${biItem.biId}:`, {
          type: biItem.type,
          color: color,
          trend: biItem.trend,
          startIndex: biItem.startIndex,
          endIndex: biItem.endIndex,
          startPrice: biItem.startPrice,
          endPrice: biItem.endPrice,
          highest: biItem.highest,
          lowest: biItem.lowest,
        });

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
      // 数据长度与K线数据对齐，使用占位符数组
      data: biPlaceholdersRef.current,
      z: 10,
    };
  }, []);

  // 创建中枢的数据
  const createChannelSeries = useCallback((): CustomSeriesOption => {
    return {
      name: "channel",
      type: "custom",
      renderItem: (params, api) => {
        const dataIndex = params.dataIndex;
        const placeholderValue = channelPlaceholdersRef.current[dataIndex];

        // 如果这个位置没有中枢占位符，跳过
        if (placeholderValue === null) {
          return null;
        }

        // 根据占位符值找到对应的中枢
        const channel = channelDataRef.current.find(
          (c) => c.channelId === placeholderValue
        );

        if (!channel) {
          return null;
        }

        // 获取坐标
        const startPoint = api.coord([channel.startIndex, channel.gg]);
        const endPoint = api.coord([channel.endIndex, channel.dd]);

        if (!startPoint || !endPoint) {
          return null;
        }

        // 获取 K 线柱子的宽度信息
        const sizeResult = api.size?.([1, 0]) || [20, 0];
        const barWidth = Array.isArray(sizeResult) ? sizeResult[0] : sizeResult;
        const halfBarWidth = barWidth * 0.4;

        // 计算矩形的位置和大小
        const x = startPoint[0] - halfBarWidth;
        const y = Math.min(startPoint[1], endPoint[1]);
        const width = endPoint[0] - startPoint[0] + barWidth * 0.8;
        const height = Math.abs(startPoint[1] - endPoint[1]);

        const color = getChannelColor(channel.type);
        const fillColor = hexToRgba(
          color,
          channel.type === "complete" ? 0.15 : 0.08
        );

        // 获取 zg 和 zd 的 y 坐标
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
            // 主填充矩形
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
            // 上沿线 (zg)
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
            // 下沿线 (zd)
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
            // 边框矩形
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
      name: "fenxing",
      type: "custom",
      renderItem: (params, api) => {
        const dataIndex = params.dataIndex;
        const placeholderValue = fenxingPlaceholdersRef.current[dataIndex];

        // 如果这个位置没有分型占位符，跳过
        if (placeholderValue === null) {
          return null;
        }

        // 根据占位符值找到对应的分型
        const fenxing = fenxingDataRef.current.find(
          (f) => f.index === placeholderValue
        );

        if (!fenxing) {
          return null;
        }

        // 获取分型位置的坐标
        const point = api.coord([fenxing.index, fenxing.price]);

        // 检查坐标是否有效
        if (!point) {
          return null;
        }

        // 获取 K 线柱子的宽度信息
        const sizeResult = api.size?.([1, 0]) || [20, 0];
        const barWidth = Array.isArray(sizeResult) ? sizeResult[0] : sizeResult;

        // 分型颜色：顶分型用蓝色，底分型用橙色
        const color = fenxing.type === "top" ? "#2196f3" : "#ff9800";
        const size = barWidth * 0.4; // 减小标记大小
        const halfSize = size / 2;
        const offset = barWidth * 1.5; // 距离K线的偏移量

        // 顶分型用倒三角（绘制在上方），底分型用圆点
        if (fenxing.type === "top") {
          // 顶分型：绘制倒三角，向上偏移
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
              stroke: "#fff",
              lineWidth: 2,
            },
            z: 15,
          };
        } else {
          // 底分型：绘制圆点，向下偏移
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
              stroke: "#fff",
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

  const setOption = useCallback(
    (chart: echarts.ECharts) => {
      if (!chart || k.length === 0) return;

      const dates = formatDateArray(k);
      const klineData = formatKlineData(k);
      const volumes = formatVolumeData(k);
      const {
        min: minPrice,
        max: maxPrice,
        range: priceRange,
      } = calculatePriceRange(k);

      const options: ECOption = {
        title: TITLE_CONFIG,
        legend: LEGEND_CONFIG,
        tooltip: {
          ...TOOLTIP_CONFIG,
          formatter: function (params: unknown) {
            const paramsArray = params as Array<{ dataIndex: number }>;
            return formatKTooltip(paramsArray, k, dates);
          },
        },
        axisPointer: {
          link: [{ xAxisIndex: "all" }],
          label: { backgroundColor: "#777" },
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
            min: 0,
          },
        ],
        dataZoom: DATAZOOM_CONFIG,
        series: [
          {
            name: "K线",
            type: "candlestick",
            data: klineData,
            itemStyle: {
              color: COLORS.up,
              color0: COLORS.down,
              borderColor: COLORS.up,
              borderColor0: COLORS.down,
            },
          },
          // Temporarily disable channel to focus on fenxing and bi visualization
          // createChannelSeries(),
          createMergeKSeries(),
          createBiSeries(),
          createFenxingSeries(),
          {
            name: "成交量",
            type: "bar",
            xAxisIndex: 1,
            yAxisIndex: 1,
            data: volumes,
            itemStyle: {
              color: function (params: { dataIndex: number }) {
                const dataIndex = params.dataIndex;
                const kline = klineData[dataIndex];
                if (!kline) return COLORS.down;
                return kline[1] > kline[0] ? COLORS.up : COLORS.down;
              },
            },
          },
        ],
      };

      chart.setOption(options, true);
    },
    [k, createMergeKSeries, createFenxingSeries]
  );

  return { setOption };
}
