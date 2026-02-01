"use client";
import {
  BiType,
  IFetchBi,
  IFetchK,
  IMergeK,
  TrendDirection,
} from "@/app/api/fetch";
import type {
  BarSeriesOption,
  CandlestickSeriesOption,
  CustomSeriesOption,
} from "echarts/charts";
import { BarChart, CandlestickChart, CustomChart } from "echarts/charts";
import type {
  DatasetComponentOption,
  DataZoomComponentOption,
  GridComponentOption,
  LegendComponentOption,
  TitleComponentOption,
  TooltipComponentOption,
} from "echarts/components";
import {
  DatasetComponent,
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
  TransformComponent,
} from "echarts/components";
import type { ComposeOption } from "echarts/core";
import * as echarts from "echarts/core";
import { LabelLayout, UniversalTransition } from "echarts/features";
import { CanvasRenderer } from "echarts/renderers";
import { use, useCallback, useEffect, useRef } from "react";

echarts.use([
  CandlestickChart,
  BarChart,
  CustomChart,
  TitleComponent,
  LegendComponent,
  DataZoomComponent,
  TooltipComponent,
  GridComponent,
  DatasetComponent,
  TransformComponent,
  LabelLayout,
  UniversalTransition,
  CanvasRenderer,
]);

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

interface KPanelProps {
  k: IFetchK[];
  mergeK: Promise<IMergeK[]>;
  bi: Promise<IFetchBi[]>;
}

// 定义合并K线矩形的类型
interface MergeKRect {
  startIndex: number;
  endIndex: number;
  highest: number;
  lowest: number;
  trend: TrendDirection;
  rectId: number;
}

// 定义笔数据的类型
interface BiMappedData {
  startIndex: number;
  endIndex: number;
  startPrice: number;
  endPrice: number;
  trend: TrendDirection;
  type: BiType;
  independentCount: number;
  originData: IFetchK[];
  highest: number;
  lowest: number;
  biId: number; // 添加唯一的ID用于标识笔
}

// 根据 BiType 获取颜色
const getBiColor = (type: BiType): string => {
  switch (type) {
    case BiType.Initial: // 初始笔
      return "#ff9800"; // 橙色
    case BiType.UnComplete: // 未完成笔
      return "#9c27b0"; // 紫色
    case BiType.Complete: // 完成笔
      return "#2196f3"; // 蓝色
    default:
      return "#666"; // 默认灰色
  }
};

interface BiStyle {
  lineWidth: number;
  lineDash: number[];
  opacity: number;
}

// 根据 TrendDirection 获取样式
const getBiStyle = (trend: TrendDirection): BiStyle => {
  switch (trend) {
    case TrendDirection.Up:
      return {
        lineWidth: 2,
        lineDash: [], // 实线
        opacity: 1,
      };
    case TrendDirection.Down:
      return {
        lineWidth: 2,
        lineDash: [5, 3], // 虚线
        opacity: 1,
      };
    case TrendDirection.None:
      return {
        lineWidth: 1,
        lineDash: [2, 2], // 点线
        opacity: 0.6,
      };
    default:
      return {
        lineWidth: 2,
        lineDash: [],
        opacity: 1,
      };
  }
};

function KPanel(props: KPanelProps) {
  const k = props.k;
  const mergeK = use(props.mergeK);
  const bi = use(props.bi);
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  // 保存合并K线矩形数据
  const mergeKRectsRef = useRef<MergeKRect[]>([]);
  const mergeKPlaceholdersRef = useRef<Array<number | null>>([]);

  // 保存笔数据
  const biDataRef = useRef<BiMappedData[]>([]);
  const biPlaceholdersRef = useRef<Array<number | null>>([]);

  // 计算合并K线矩形的数据
  const calculateMergeKRects = useCallback(() => {
    if (k.length === 0 || mergeK.length === 0) return [];

    const mergeKRects: MergeKRect[] = [];

    mergeK.forEach((merge, index) => {
      const startTime = new Date(merge.startTime);
      const endTime = new Date(merge.endTime);

      const startIndex = k.findIndex((item) => {
        const kTime = new Date(item.time);
        return kTime.getTime() === startTime.getTime();
      });

      const endIndex = k.findIndex((item) => {
        const kTime = new Date(item.time);
        return kTime.getTime() === endTime.getTime();
      });

      if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
        mergeKRects.push({
          startIndex,
          endIndex,
          highest: merge.highest,
          lowest: merge.lowest,
          trend: merge.trend,
          rectId: index,
        });
      }
    });

    return mergeKRects;
  }, [k, mergeK]);

  // 计算笔数据
  const calculateBiData = useCallback(() => {
    if (k.length === 0 || bi.length === 0) return [];

    const biData: BiMappedData[] = [];

    bi.forEach((b, index) => {
      const startTime = new Date(b.startTime);
      const endTime = new Date(b.endTime);

      const startIndex = k.findIndex((item) => {
        const kTime = new Date(item.time);
        return kTime.getTime() === startTime.getTime();
      });

      const endIndex = k.findIndex((item) => {
        const kTime = new Date(item.time);
        return kTime.getTime() === endTime.getTime();
      });

      if (startIndex === -1 || endIndex === -1) {
        return null;
      }

      biData.push({
        startIndex,
        endIndex,
        startPrice: b.trend === TrendDirection.Up ? b.lowest : b.highest,
        endPrice: b.trend === TrendDirection.Up ? b.highest : b.lowest,
        trend: b.trend,
        type: b.type,
        independentCount: b.independentCount,
        originData: b.originData,
        highest: b.highest,
        lowest: b.lowest,
        biId: index,
      });
    });

    return biData;
  }, [k, bi]);

  // 创建合并K线的占位符数组
  const createMergeKPlaceholders = useCallback(
    (mergeKRects: MergeKRect[]) => {
      const placeholders: Array<number | null> = new Array(k.length).fill(null);

      // 在每个矩形的开始位置放置矩形ID
      mergeKRects.forEach((rect) => {
        if (rect.startIndex >= 0 && rect.startIndex < placeholders.length) {
          placeholders[rect.startIndex] = rect.rectId;
        }
      });

      return placeholders;
    },
    [k.length]
  );

  // 创建笔的占位符数组
  // 创建笔的占位符数组（放在中间位置）
  const createBiPlaceholders = useCallback(
    (biData: BiMappedData[]) => {
      const placeholders: Array<number | null> = new Array(k.length).fill(null);

      // 在每个笔的中间位置放置笔ID
      biData.forEach((biItem) => {
        const midIndex = Math.floor((biItem.startIndex + biItem.endIndex) / 2);
        
        // 如果笔的K线数量是偶数，使用较小的中间索引（你的建议：偶数就index-1）
        if ((biItem.endIndex - biItem.startIndex + 1) % 2 === 0) {
          // 已经使用Math.floor，所以会自动向下取整，对于偶数来说就是较小的中间索引
        }
        
        if (midIndex >= 0 && midIndex < placeholders.length) {
          placeholders[midIndex] = biItem.biId;
        }
      });

      return placeholders;
    },
    [k.length]
  );

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
            fill:
              rect.trend === "up"
                ? "rgba(239, 83, 80, 0.1)"
                : "rgba(38, 166, 154, 0.1)",
            stroke: rect.trend === "up" ? "#ef5350" : "#26a69a",
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

        const color = getBiColor(biItem.type);
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
      // 数据长度与K线数据对齐，使用占位符数组
      data: biPlaceholdersRef.current,
      z: 10,
    };
  }, []);

  const setOption = useCallback(() => {
    if (!chartRef.current || k.length === 0) return;

    // 计算合并K线矩形数据
    mergeKRectsRef.current = calculateMergeKRects();
    mergeKPlaceholdersRef.current = createMergeKPlaceholders(
      mergeKRectsRef.current
    );

    // 计算笔数据
    biDataRef.current = calculateBiData();
    biPlaceholdersRef.current = createBiPlaceholders(biDataRef.current);

    // 准备数据
    const dates = k.map((item) => {
      const date = new Date(item.time);
      return `${date.getMonth() + 1}/${date.getDate()}`;
    });
    const klineData = k.map((item) => [
      item.open,
      item.close,
      item.lowest,
      item.highest,
    ]);
    const volumes = k.map((item) => item.amount);

    // 计算 K 线数据的最小值和最大值
    const prices = k.flatMap((item) => [
      item.highest,
      item.lowest,
      item.open,
      item.close,
    ]);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice;

    const options: ECOption = {
      title: {
        text: "K线图",
        left: 0,
      },
      legend: {
        data: ["K线", "成交量", "笔"],
        top: 30,
      },
      tooltip: {
        trigger: "axis",
        axisPointer: {
          type: "cross",
        },
        borderWidth: 1,
        borderColor: "#ccc",
        padding: 10,
        textStyle: {
          color: "#000",
        },
        formatter: function (params: unknown) {
          const paramsArray = params as Array<{ dataIndex: number }>;
          const dataIndex = paramsArray[0].dataIndex;
          const item = k[dataIndex];
          return [
            `日期: ${dates[dataIndex]}`,
            `开盘: ${item.open}`,
            `收盘: ${item.close}`,
            `最低: ${item.lowest}`,
            `最高: ${item.highest}`,
            `成交量: ${item.amount}`,
          ].join("<br/>");
        },
      },
      axisPointer: {
        link: [{ xAxisIndex: "all" }],
        label: { backgroundColor: "#777" },
      },
      grid: [
        {
          left: "10%",
          right: "8%",
          height: "50%",
        },
        {
          left: "10%",
          right: "8%",
          top: "63%",
          height: "16%",
        },
      ],
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
      dataZoom: [
        {
          type: "inside",
          xAxisIndex: [0, 1],
          start: 0,
          end: 100,
        },
        {
          show: true,
          xAxisIndex: [0, 1],
          type: "slider",
          top: "85%",
          start: 0,
          end: 100,
        },
      ],
      series: [
        {
          name: "K线",
          type: "candlestick",
          data: klineData,
          itemStyle: {
            color: "#ef5350",
            color0: "#26a69a",
            borderColor: "#ef5350",
            borderColor0: "#26a69a",
          },
        },
        createMergeKSeries(),
        createBiSeries(),
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
              return kline[1] > kline[0] ? "#ef5350" : "#26a69a";
            },
          },
        },
      ],
    };

    chartRef.current.setOption(options, true);
  }, [
    k,
    calculateMergeKRects,
    createMergeKPlaceholders,
    calculateBiData,
    createBiPlaceholders,
    createMergeKSeries,
    createBiSeries,
  ]);

  useEffect(() => {
    if (!containerRef.current) return;

    const myChart = echarts.init(containerRef.current);
    chartRef.current = myChart;
    setOption();

    return () => {
      chartRef.current?.dispose();
      chartRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (
      chartRef.current &&
      k.length > 0 &&
      mergeK.length > 0 &&
      bi.length > 0
    ) {
      setOption();
    }
  }, [k, mergeK, bi, setOption]);

  return (
    <div
      ref={containerRef}
      id="k-panel"
      style={{ width: "100%", height: 600 }}
    ></div>
  );
}

export default KPanel;
