"use client";
import {
  BarChart,
  CandlestickChart,
  CustomChart,
  LineChart,
} from "echarts/charts";
import {
  DatasetComponent,
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
  TransformComponent,
} from "echarts/components";
import * as echarts from "echarts/core";
import { LabelLayout, UniversalTransition } from "echarts/features";
import { CanvasRenderer } from "echarts/renderers";
import { K_PANEL_HEIGHT } from "./config/chartOptions";
import { useChartConfig } from "./hooks/useChartConfig";
import { useChartData } from "./hooks/useChartData";
import { useChartRender } from "./hooks/useChartRender";
import type { KPanelProps } from "./types";

echarts.use([
  CandlestickChart,
  BarChart,
  LineChart,
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

// Re-export types for external use
export type {
  BiMappedData,
  BiStyle,
  BspSignalMappedData,
  BspSignalSourceData,
  ChannelMappedData,
  DuanChannelMappedData,
  DuanMappedData,
  ECOption,
  KPanelProps,
  MacdData,
  MergeKRect,
  SubChartType,
} from "./types";

function KPanel(props: KPanelProps) {
  const { data, isReady } = useChartData(
    props.k,
    props.mergeK,
    props.bi,
    props.fenxing,
    props.channel,
    props.duan,
    props.duanChannel,
    props.signals
  );
  const { setOption } = useChartConfig({
    k: props.k,
    subChartType: props.subChartType,
    onSignalClick: props.onSignalClick,
    focusedSignalTime: props.focusedSignalTime,
    ...(data || {
      mergeKRects: [],
      biData: [],
      mergeKPlaceholders: [],
      biPlaceholders: [],
      channelData: [],
      channelPlaceholders: [],
      fenxingData: [],
      fenxingPlaceholders: [],
      duanData: [],
      duanPlaceholders: [],
      duanChannelData: [],
      duanChannelPlaceholders: [],
      bspData: [],
      bspPlaceholders: [],
      macdData: { dif: [], dea: [], hist: [] },
    }),
  });
  const containerRef = useChartRender({ setOption, isEnabled: isReady });

  return (
    <div
      ref={containerRef}
      id="k-panel"
      style={{ width: "100%", height: K_PANEL_HEIGHT }}
    ></div>
  );
}

export default KPanel;

