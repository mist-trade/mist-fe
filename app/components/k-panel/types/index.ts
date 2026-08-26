import {
  BiType,
  BiStatus,
  ChanBspEventType,
  ChannelLevel,
  ChannelType,
  DuanStatus,
  DuanType,
  FenxingType,
  IFenxing,
  IFetchBi,
  IFetchChannel,
  IFetchDuan,
  IFetchDuanChannel,
  IFetchK,
  IMergeK,
  TrendDirection,
} from "@/app/api/types";
import type {
  BarSeriesOption,
  CandlestickSeriesOption,
  CustomSeriesOption,
  LineSeriesOption,
} from "echarts/charts";
import type {
  DatasetComponentOption,
  DataZoomComponentOption,
  GridComponentOption,
  LegendComponentOption,
  TitleComponentOption,
  TooltipComponentOption,
} from "echarts/components";
import type { ComposeOption } from "echarts/core";

export type ECOption = ComposeOption<
  | CandlestickSeriesOption
  | BarSeriesOption
  | LineSeriesOption
  | CustomSeriesOption
  | TitleComponentOption
  | LegendComponentOption
  | TooltipComponentOption
  | GridComponentOption
  | DatasetComponentOption
  | DataZoomComponentOption
>;

export interface FenxingMappedData {
  index: number;
  type: FenxingType;
  date: string;
  price: number;
  high: number;
  low: number;
}

export type SubChartType = "volume" | "macd";

export interface KPanelProps {
  k: IFetchK[];
  mergeK: Promise<IMergeK[]>;
  bi: Promise<IFetchBi[]>;
  fenxing: Promise<IFenxing[]>;
  channel: Promise<IFetchChannel[]>;
  duan?: Promise<IFetchDuan[]>;
  duanChannel?: Promise<IFetchDuanChannel[]>;
  signals?: Promise<BspSignalSourceData[]> | BspSignalSourceData[];
  subChartType?: SubChartType;
  onSignalClick?: (signal: BspSignalMappedData) => void;
  focusedSignalTime?: string | null;
}

// 定义合并K线矩形的类型
export interface MergeKRect {
  startIndex: number;
  endIndex: number;
  high: number;
  low: number;
  trend: TrendDirection;
  rectId: number;
}

// 定义笔数据的类型
export interface BiMappedData {
  startIndex: number;
  endIndex: number;
  startPrice: number;
  endPrice: number;
  trend: TrendDirection;
  type: BiType;
  status: BiStatus; // 笔的状态
  independentCount: number;
  originData: IFetchK[];
  high: number;
  low: number;
  biId: number; // 添加唯一的ID用于标识笔
}

export interface BiStyle {
  lineWidth: number;
  lineDash: number[];
  opacity: number;
}

// 定义中枢数据的映射类型
export interface ChannelMappedData {
  channelId: number;
  startIndex: number;
  endIndex: number;
  zg: number; // 中枢上沿
  zd: number; // 中枢下沿
  trend: TrendDirection;
  type: ChannelType;
  level: ChannelLevel;
  bis: BiMappedData[];
}

// 定义线段数据的映射类型
export interface DuanMappedData {
  duanId: number;
  startIndex: number;
  endIndex: number;
  startPrice: number;
  endPrice: number;
  trend: TrendDirection;
  type: DuanType;
  status: DuanStatus;
  independentCount: number;
  high: number;
  low: number;
}

// 定义段中枢数据的映射类型
export interface DuanChannelMappedData {
  channelId: number;
  startIndex: number;
  endIndex: number;
  zg: number;
  zd: number;
  gg: number;
  dd: number;
  type: ChannelType;
  level: ChannelLevel;
  expanded?: boolean;
}

// 买卖点原始数据输入源
export interface BspSignalSourceData {
  id?: number;
  securityCode?: string;
  signalTime: string | Date;
  signalKind?: string;
  type?: ChanBspEventType | string;
  price?: number;
  contextSnapshot?: Record<string, unknown>;
  ruleSnapshot?: Record<string, unknown>;
}

// 买卖点在图表中的映射数据
export interface BspSignalMappedData {
  bspId: number;
  index: number;
  time: string;
  price: number;
  type: ChanBspEventType | string;
  label: string; // "1买", "1卖", "2买", "2卖", "3买", "3卖", "买", "卖"
  isBuy: boolean;
  rawSignal: BspSignalSourceData;
}

// MACD 计算结果
export interface MacdData {
  dif: Array<number | null>;
  dea: Array<number | null>;
  hist: Array<number | null>;
}

