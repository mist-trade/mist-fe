export interface IFetchK {
  id: number;
  symbol: string;
  time: Date | string;
  amount: number;
  volume?: number;
  vol?: number;
  open: number;
  close: number;
  high: number;
  low: number;
}


export enum TrendDirection {
  Up = "up",
  Down = "down",
  None = "none",
}

export enum BiType {
  UnComplete = "uncomplete",
  Complete = "complete",
}

export enum BiStatus {
  Unknown = 0,
  Valid = 1,
  Invalid = 2,
}

export enum ChannelLevel {
  Bi = "bi",
  Duan = "duan",
  Macro = "macro",
}

export enum ChannelType {
  Complete = "complete",
  UnComplete = "uncomplete",
}

export enum ChannelStatus {
  Unknown = 0,
  Valid = 1,
  Invalid = 2,
}

export interface IMergeK {
  startTime: Date | string;
  endTime: Date | string;
  high: number;
  low: number;
  trend: TrendDirection;
  mergedCount: number;
  mergedIds: number[];
  mergedData: IFetchK[];
}

export type FenxingType = "top" | "bottom";

export interface IFenxing {
  type: FenxingType;
  high: number;
  low: number;
  leftIds: number[];
  middleIds: number[];
  rightIds: number[];
  middleIndex: number;
  middleOriginId: number;
}

export interface IFetchBi {
  startTime: Date | string;
  endTime: Date | string;
  high: number;
  low: number;
  trend: TrendDirection;
  type: BiType;
  status: BiStatus;
  independentCount: number;
  originIds: number[];
  originData: IFetchK[];
  startFenxing: IFenxing | null;
  endFenxing: IFenxing | null;
}

export interface IFetchBiChannel {
  zg: number;
  zd: number;
  gg: number;
  dd: number;
  level: ChannelLevel;
  type: ChannelType;
  status?: ChannelStatus;
  extended?: boolean;
  expanded?: boolean;
  upgradedLevel?: ChannelLevel;
  startId: number;
  endId: number;
  trend: TrendDirection;
  bis: IFetchBi[];
  entryBi: IFetchBi;
  leaveBi?: IFetchBi;
}

export enum DuanType {
  UnComplete = "uncomplete",
  Complete = "complete",
}

export enum DuanStatus {
  Unknown = 0,
  Valid = 1,
  Invalid = 2,
}

export interface IFetchDuan {
  startTime: Date | string;
  endTime: Date | string;
  high: number;
  low: number;
  trend: TrendDirection;
  type: DuanType;
  status: DuanStatus;
  independentCount: number;
  originIds: number[];
  originBis: IFetchBi[];
  startBi: IFetchBi | null;
  endBi: IFetchBi | null;
}

export interface IFetchDuanChannel {
  zg: number;
  zd: number;
  gg: number;
  dd: number;
  level: ChannelLevel;
  type: ChannelType;
  status?: ChannelStatus;
  expanded?: boolean;
  upgradedLevel?: ChannelLevel;
  startId: number;
  endId: number;
  duans: IFetchDuan[];
  entryDuan: IFetchDuan;
  leaveDuan?: IFetchDuan;
}

export interface IFetchDuanChannelPhases {
  phaseA: IFetchDuanChannel[];
  phaseB: IFetchDuanChannel[];
}

export type ChanBspEventType =
  | "first_buy"
  | "first_sell"
  | "second_buy"
  | "second_sell"
  | "third_buy"
  | "third_sell";

/**
 * 两阶段笔中枢结果（镜像后端 BiChannelTwoPhaseResult）：
 * - phaseA: 枚举的所有基础笔中枢
 * - phaseB: 定点迭代合并后的最终笔中枢序列
 */
export interface IFetchBiChannelPhases {
  phaseA: IFetchBiChannel[];
  phaseB: IFetchBiChannel[];
}

/**
 * 两阶段笔结果（镜像后端 BiTwoPhaseResult）：
 * - phaseA: 三笔合并输出（valid + invalid 残留混合）
 * - phaseB: n笔合并后处理输出（消化 invalid 残留后的干净序列）
 */
export interface IFetchBiPhases {
  phaseA: IFetchBi[];
  phaseB: IFetchBi[];
}

