import {
  BiType,
  BiStatus,
  ChannelLevel,
  ChannelType,
  FenxingType,
  IFenxing,
  IFetchBi,
  IFetchChannel,
  IFetchK,
  IMergeK,
  TrendDirection,
} from "@/app/api/types";
import type {
  BarSeriesOption,
  CandlestickSeriesOption,
  CustomSeriesOption,
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
  highest: number;
  lowest: number;
}

export interface KPanelProps {
  k: IFetchK[];
  mergeK: Promise<IMergeK[]>;
  bi: Promise<IFetchBi[]>;
  fenxing: Promise<IFenxing[]>;
  channel: Promise<IFetchChannel[]>;
}

// 定义合并K线矩形的类型
export interface MergeKRect {
  startIndex: number;
  endIndex: number;
  highest: number;
  lowest: number;
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
  highest: number;
  lowest: number;
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
  gg: number; // 中枢最高
  dd: number; // 中枢最低
  trend: TrendDirection;
  type: ChannelType;
  level: ChannelLevel;
  bis: BiMappedData[];
}
