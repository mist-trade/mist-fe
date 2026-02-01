"use client";
import { IFetchBi, IFetchK, IMergeK, TrendDirection } from "@/app/api/fetch";
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
  rectId: number; // 添加唯一的ID用于标识矩形
}

function KPanel(props: KPanelProps) {
  const k = props.k;
  const mergeK = use(props.mergeK);
  const bi = use(props.bi);
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  // 保存合并K线矩形数据
  const mergeKRectsRef = useRef<MergeKRect[]>([]);
  // 保存占位符数组
  const mergeKPlaceholdersRef = useRef<Array<number | null>>([]);

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
          rectId: index, // 使用索引作为ID
        });
      }
    });

    return mergeKRects;
  }, [k, mergeK]);

  // 创建占位符数组
  const createPlaceholders = useCallback(
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

  // 创建自定义系列配置
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

  const setOption = useCallback(() => {
    if (!chartRef.current || k.length === 0) return;

    // 计算合并K线矩形数据
    mergeKRectsRef.current = calculateMergeKRects();
    // 创建占位符数组
    mergeKPlaceholdersRef.current = createPlaceholders(mergeKRectsRef.current);

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
        data: ["K线", "成交量"],
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
  }, [k, calculateMergeKRects, createPlaceholders, createMergeKSeries]);

  useEffect(() => {
    if (!containerRef.current) return;

    const myChart = echarts.init(containerRef.current);
    chartRef.current = myChart;
    setOption();

    return () => {
      chartRef.current?.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (chartRef.current && k.length > 0 && mergeK.length > 0) {
      setOption();
    }
  }, [k, mergeK, setOption]);

  return (
    <div
      ref={containerRef}
      id="k-panel"
      style={{ width: "100%", height: 600 }}
    ></div>
  );
}

export default KPanel;
