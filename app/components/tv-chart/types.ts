import type { UTCTimestamp } from "lightweight-charts";
import type { IFetchK } from "@/app/api/types";
import type { VisualCommandVo } from "@/app/api/client";

export interface ChartKLine {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface OhlcHoverVo {
  time: string | number | Date;
  timeLabel: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  amount?: number;
  isUp: boolean;
}

export interface TradingViewChartProps {
  k: IFetchK[];
  commands?: VisualCommandVo[];
  height?: number;
  subChartType?: "volume" | "macd" | "none";
  className?: string;
  onSignalClick?: (signal: unknown) => void;
  focusedSignalTime?: string | null;
  /** 笔折线自定义颜色（默认 #FACC15） */
  biColor?: string;
  /** 笔折线线宽（默认 1） */
  biWidth?: number;
  /** 是否在图表左上角展示随十字线联动的 OHLCVA 悬浮图例，默认开启 */
  showOhlcLegend?: boolean;
  /** 十字线悬浮的 OHLC 回调，供外层在图表外渲染固定信息条 */
  onOhlcHover?: (data: OhlcHoverVo | null) => void;
}

export interface TradingViewLineChartProps {
  data: Array<{ time: string; value: number }>;
  height?: number;
  color?: string;
  areaColor?: string;
  title?: string;
  valueFormatter?: (val: number) => string;
}
