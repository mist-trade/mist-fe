import {
  BiType,
  IFetchBi,
  IFetchK,
  IMergeK,
  TrendDirection,
} from "@/app/api/fetch";

export interface KPanelProps {
  k: IFetchK[];
  mergeK: Promise<IMergeK[]>;
  bi: Promise<IFetchBi[]>;
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
