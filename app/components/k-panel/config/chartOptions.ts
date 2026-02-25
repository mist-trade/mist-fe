import type {
  GridComponentOption,
  LegendComponentOption,
  TitleComponentOption,
  TooltipComponentOption,
  DataZoomComponentOption,
} from "echarts/components";

// Chart title configuration
export const TITLE_CONFIG: TitleComponentOption = {
  text: "K线图",
  left: 0,
};

// Chart legend configuration
export const LEGEND_CONFIG: LegendComponentOption = {
  data: ["K线", "成交量", "笔"],
  top: 30,
};

// Chart tooltip configuration
export const TOOLTIP_CONFIG: TooltipComponentOption = {
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
};

// Chart grid configuration
export const GRID_CONFIG: GridComponentOption[] = [
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
];

// Chart dataZoom configuration
export const DATAZOOM_CONFIG: DataZoomComponentOption[] = [
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
];
