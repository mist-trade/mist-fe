"use client";
import { IFetchBi, IFetchK, IMergeK } from "@/app/api/fetch";
import type { BarSeriesOption, CandlestickSeriesOption, CustomSeriesOption } from "echarts/charts";
import { BarChart, CandlestickChart, CustomChart } from "echarts/charts";
import type {
  DatasetComponentOption,
  GridComponentOption,
  LegendComponentOption,
  TitleComponentOption,
  TooltipComponentOption,
  DataZoomComponentOption,
} from "echarts/components";
import {
  DatasetComponent,
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
  TransformComponent,
  DataZoomComponent,
} from "echarts/components";
import type { ComposeOption } from "echarts/core";
import * as echarts from "echarts/core";
import { LabelLayout, UniversalTransition } from "echarts/features";
import { CanvasRenderer } from "echarts/renderers";
import { use, useEffect, useRef } from "react";

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

function KPanel(props: KPanelProps) {
  const k = props.k;
  const mergeK = use(props.mergeK);
  const bi = use(props.bi);
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  const setOption = () => {
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

    // 计算 K 线数据的最小值和最大值，用于 y 轴自适应
    const prices = k.flatMap(item => [item.highest, item.lowest, item.open, item.close]);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice;

    // 准备 mergeK 矩形数据 - 标记哪些K线属于合并K线
    const mergedKIndices = new Set<number>();
    const mergeKRects = mergeK.map((merge) => {
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
      
      if (startIndex === -1 || endIndex === -1) {
        return null;
      }
      
      // 只标记真正的合并K线（包含多个原始K线）
      // 如果是合并K线（包含多个原始K线），才添加到集合中
      if (endIndex > startIndex) {
        for (let i = startIndex; i <= endIndex; i++) {
          mergedKIndices.add(i);
        }
        return {
          startIndex,
          endIndex,
          highest: merge.highest,
          lowest: merge.lowest,
          trend: merge.trend,
        };
      }
      
      return null;
    }).filter((item) => item !== null);

    // 创建 custom series 绘制 mergeK 的虚线边框
    // 这里只会在被合并的K线上绘制虚线框
    const mergeKBorderSeries = {
      name: "mergeK-border",
      type: "custom" as const,
      renderItem: (params: { dataIndex: number }, api) => {
        const kIndex = params.dataIndex;
        
        // 只渲染属于合并K线的索引，并且需要是合并K线（而不是单根K线）
        if (!mergedKIndices.has(kIndex)) {
          return null;
        }
        
        // 检查这个K线是否属于一个真正的合并范围（而不是单根K线）
        const isInMergeRange = mergeKRects.some(rect => 
          rect && kIndex >= rect.startIndex && kIndex <= rect.endIndex
        );
        
        if (!isInMergeRange) {
          return null;
        }
        
        const item = k[kIndex];
        const open = item.open;
        const close = item.close;
        const lowest = item.lowest;
        const highest = item.highest;
        
        // 获取坐标点
        const highPoint = api.coord([kIndex, highest]);
        const lowPoint = api.coord([kIndex, lowest]);
        const openPoint = api.coord([kIndex, open]);
        const closePoint = api.coord([kIndex, close]);
        
        // 获取 K 线柱子的宽度
        const sizeResult = api.size?.([1, 0]) || 20;
        const barWidth = Array.isArray(sizeResult) ? sizeResult[0] : sizeResult;
        const halfBarWidth = barWidth * 0.4;
        
        const isUp = close > open;
        const color = isUp ? "#ef5350" : "#26a69a";
        
        // K 线实体矩形的边框
        const rectTop = Math.min(openPoint[1], closePoint[1]);
        const rectHeight = Math.abs(openPoint[1] - closePoint[1]) || 1;
        
        return {
          type: "group",
          children: [
            // 上影线虚线
            {
              type: "line",
              shape: {
                x1: highPoint[0],
                y1: highPoint[1],
                x2: highPoint[0],
                y2: rectTop,
              },
              style: {
                stroke: color,
                lineWidth: 1.5,
                lineDash: [3, 3],
              },
            },
            // 下影线虚线
            {
              type: "line",
              shape: {
                x1: lowPoint[0],
                y1: lowPoint[1],
                x2: lowPoint[0],
                y2: rectTop + rectHeight,
              },
              style: {
                stroke: color,
                lineWidth: 1.5,
                lineDash: [3, 3],
              },
            },
            // 矩形虚线边框
            {
              type: "rect",
              shape: {
                x: highPoint[0] - halfBarWidth,
                y: rectTop,
                width: barWidth * 0.8,
                height: rectHeight,
              },
              style: {
                fill: "transparent",
                stroke: color,
                lineWidth: 1.5,
                lineDash: [3, 3],
              },
            },
          ],
          z: 20,
        };
      },
      data: k.map((_, idx) => idx),
      z: 20,
    } as CustomSeriesOption;

    const mergeKSeries = {
      name: "mergeK",
      type: "custom" as const,
      renderItem: (params: { dataIndex: number }, api) => {
        const rectIndex = params.dataIndex;
        const rect = mergeKRects[rectIndex];
        
        if (!rect || rect.startIndex === rect.endIndex) {
          return null;
        }
        
        // 获取起始和结束位置的坐标
        const startPoint = api.coord([rect.startIndex, rect.highest]);
        const endPoint = api.coord([rect.endIndex, rect.lowest]);
        
        // 获取 K 线柱子的宽度信息
        const sizeResult = api.size?.([1, 0]) || 20;
        const barWidth = Array.isArray(sizeResult) ? sizeResult[0] : sizeResult;
        
        const halfBarWidth = barWidth * 0.4;
        // 计算矩形的位置和大小 - 从第一根K线左边缘到最后一根K线右边缘
        const x = startPoint[0] - halfBarWidth;
        const y = Math.min(startPoint[1], endPoint[1]);
        const width = (endPoint[0] - startPoint[0]) + barWidth * 0.8;
        const height = Math.abs(startPoint[1] - endPoint[1]);
        
        return {
          type: "rect" as const,
          shape: {
            x,
            y,
            width,
            height,
          },
          style: {
            fill: rect.trend === "up" ? "rgba(239, 83, 80, 0.1)" : "rgba(38, 166, 154, 0.1)",
            stroke: rect.trend === "up" ? "#ef5350" : "#26a69a",
            lineWidth: 1,
            lineDash: [5, 5],
          },
          z: 5,
        };
      },
      data: mergeKRects.map((_, idx) => idx),
      z: 5,
    } as CustomSeriesOption;

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
          // 修复 y 轴从 0 开始的问题
          min: Math.max(0, minPrice - priceRange * 0.05), // 给5%的底部边距
          max: maxPrice + priceRange * 0.05, // 给5%的顶部边距
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
        mergeKBorderSeries,
        mergeKSeries,
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
    chartRef.current?.setOption(options);
  };

  useEffect(() => {
    if (!containerRef.current) return;
    const myCharts = echarts.init(containerRef.current);
    chartRef.current = myCharts;
    setOption();

    return () => {
      chartRef.current?.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (chartRef.current && k.length > 0 && mergeK.length > 0) {
      setOption();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k, mergeK]);

  useEffect(() => {
    const handleResize = () => {
      chartRef.current?.resize();
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      id="k-panel"
      style={{ width: "100%", height: 600 }}
    ></div>
  );
}

export default KPanel;