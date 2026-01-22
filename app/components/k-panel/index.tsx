"use client";
import { IFetchBi, IFetchK, IMergeK } from "@/app/api/fetch";
import type { BarSeriesOption, CandlestickSeriesOption } from "echarts/charts";
import { BarChart, CandlestickChart } from "echarts/charts";
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
  | TitleComponentOption
  | LegendComponentOption
  | TooltipComponentOption
  | GridComponentOption
  | DatasetComponentOption
  | DataZoomComponentOption
>;

interface KPanelProps {
  k: IFetchK[];
  // mergeK: Promise<IMergeK[]>;
  bi: Promise<IFetchBi[]>;
}

function KPanel(props: KPanelProps) {
  const k = props.k;
  // const mergeK = use(props.mergeK);
  const bi = use(props.bi);
  console.log(bi);
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

    const options: ECOption = {
      title: {
        text: "K线图",
        left: 0,
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

    return () => {
      chartRef.current?.dispose();
    };
  }, []);

  useEffect(() => {
    setOption();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k]);

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
