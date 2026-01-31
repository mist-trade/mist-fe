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

  console.log("mergeK 数据:", mergeK);

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

    // 准备 mergeK 矩形数据
    const mergeKRects = mergeK.map((merge) => {
      const startTime = new Date(merge.startTime);
      const endTime = new Date(merge.endTime);
      
      const startIndex = k.findIndex((item) => {
        const kTime = new Date(item.time);
        return kTime.toDateString() === startTime.toDateString();
      });
      
      const endIndex = k.findIndex((item) => {
        const kTime = new Date(item.time);
        return kTime.toDateString() === endTime.toDateString();
      });
      
      if (startIndex === -1 || endIndex === -1) {
        return null;
      }
      
      return {
        startIndex,
        endIndex,
        highest: merge.highest,
        lowest: merge.lowest,
        trend: merge.trend,
      };
    }).filter((item) => item !== null);

    // 创建 custom series 绘制 mergeK 矩形
    const mergeKSeries = {
      name: "mergeK",
      type: "custom" as const,
      renderItem: (params: { dataIndex: number }, api) => {
        const rectIndex = params.dataIndex;
        const rect = mergeKRects[rectIndex];
        
        if (!rect) return null;
        
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
