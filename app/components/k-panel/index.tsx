"use client";
import { BarChart, CandlestickChart, CustomChart } from "echarts/charts";
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
  ChannelMappedData,
  ECOption,
  KPanelProps,
  MergeKRect,
} from "./types";

function KPanel(props: KPanelProps) {
  const { data, isReady } = useChartData(
    props.k,
    props.mergeK,
    props.bi,
    props.fenxing,
    props.channel
  );
  const { setOption } = useChartConfig({
    k: props.k,
    ...(data || {
      mergeKRects: [],
      biData: [],
      mergeKPlaceholders: [],
      biPlaceholders: [],
      channelData: [],
      channelPlaceholders: [],
      fenxingData: [],
      fenxingPlaceholders: [],
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
