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

export interface TradingViewChartProps {
  k: IFetchK[];
  commands?: VisualCommandVo[];
  height?: number;
  subChartType?: "volume" | "macd" | "none";
  className?: string;
  onSignalClick?: (signal: unknown) => void;
  focusedSignalTime?: string | null;
}

export interface TradingViewLineChartProps {
  data: Array<{ time: string; value: number }>;
  height?: number;
  color?: string;
  areaColor?: string;
  title?: string;
  valueFormatter?: (val: number) => string;
}
