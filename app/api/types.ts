export interface IFetchK {
  id: number;
  symbol: string;
  time: Date | string;
  amount: number;
  open: number;
  close: number;
  highest: number;
  lowest: number;
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
  highest: number;
  lowest: number;
  trend: TrendDirection;
  mergedCount: number;
  mergedIds: number[];
  mergedData: IFetchK[];
}

export type FenxingType = "top" | "bottom";

export interface IFenxing {
  type: FenxingType;
  highest: number;
  lowest: number;
  leftIds: number[];
  middleIds: number[];
  rightIds: number[];
  middleIndex: number;
  middleOriginId: number;
}

export interface IFetchBi {
  startTime: Date | string;
  endTime: Date | string;
  highest: number;
  lowest: number;
  trend: TrendDirection;
  type: BiType;
  status: BiStatus;
  independentCount: number;
  originIds: number[];
  originData: IFetchK[];
  startFenxing: IFenxing | null;
  endFenxing: IFenxing | null;
}

export interface IFetchChannel {
  zg: number;
  zd: number;
  gg: number;
  dd: number;
  level: ChannelLevel;
  type: ChannelType;
  status?: ChannelStatus;
  startId: number;
  endId: number;
  trend: TrendDirection;
  bis: IFetchBi[];
  displayStartId: number;
  displayEndId: number;
}

/**
 * 两阶段中枢结果（镜像后端 ChannelTwoPhaseResult）：
 * - phaseA: 固定5笔滑窗枚举的所有基础中枢
 * - phaseB: 定点迭代合并后的最终中枢序列
 */
export interface IFetchChannelPhases {
  phaseA: IFetchChannel[];
  phaseB: IFetchChannel[];
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
