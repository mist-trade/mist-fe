"use client";
import { IFetchK } from "@/app/api/fetch";
import type { CandlestickSeriesOption } from "echarts/charts";
import { CandlestickChart } from "echarts/charts";
import type {
  DatasetComponentOption,
  GridComponentOption,
  LegendComponentOption,
  TitleComponentOption,
  TooltipComponentOption,
} from "echarts/components";
import {
  DatasetComponent,
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
import { use, useEffect, useRef } from "react";

echarts.use([
  CandlestickChart,
  TitleComponent,
  LegendComponent,
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
  | TitleComponentOption
  | LegendComponentOption
  | TooltipComponentOption
  | GridComponentOption
  | DatasetComponentOption
>;

interface KPanelProps {
  data: Promise<IFetchK[]>;
}

function KPanel(props: KPanelProps) {
  const data = use(props.data);
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  const setOption = () => {
    const options: ECOption = {
      title: {
        text: "K线图",
      },
      // legend: {
      //   bottom: 10,
      //   left: 'center'
      // },
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
      xAxis: [{
        type: 'category',
        data: data.map((item) => item.lowest),
        

      }]
    };
    chartRef.current?.setOption(options);
  };

  useEffect(() => {
    if (!containerRef.current) return;
    const myCharts = echarts.init(containerRef.current);
    chartRef.current = myCharts;
  }, []);

  return (
    <div
      ref={containerRef}
      id="k-panel"
      style={{ width: 600, height: 400 }}
    ></div>
  );
}

export default KPanel;
