import { getMockData } from "@/test-data";
import { getAnalysisApiBase } from "./client";

export const BASE = getAnalysisApiBase();
const TIMEOUT = parseInt(process.env.NEXT_PUBLIC_API_TIMEOUT || "10000");

const getPath = (path: string) => `${BASE}${path}`;

const routes = {
  K: "/indicator/k",
  MACD: "/indicator/macd",
  RSI: "/indicator/rsi",
  KDJ: "/indicator/kdj",
  MergeK: "/chan/merge-k",
  Bi: "/chan/bi",
  Fenxing: "/chan/fenxing",
  Channel: "/chan/channel",
};

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

export const fetchK = async (data: {
  symbol: string;
  code: string;
  startDate: string;
  endDate: string;
}): Promise<IFetchK[]> => {
  try {
    const response = await fetch(getPath(routes.K), {
      method: "POST",
      body: JSON.stringify(data),
      headers: {
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(TIMEOUT),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching K data:", error);
    // Return mock data as fallback
    return getMockData();
  }
};

export enum TrendDirection {
  Up = "up",
  Down = "down",
  None = "none", // 无趋势
}

export enum BiType {
  UnComplete = "uncomplete",
  Complete = "complete",
}

export enum BiStatus {
  Unknown = 0,    // 未知状态（初始默认值）
  Valid = 1,      // 有效笔（满足所有条件）
  Invalid = 2,    // 无效笔（不满足条件）
}

export enum ChannelLevel {
  Bi = "bi",
  Duan = "duan",
}

export enum ChannelType {
  Complete = "complete",
  UnComplete = "uncomplete",
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

export interface IFenxing {
  type: "top" | "bottom";
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
  status: BiStatus; // 笔的状态
  independentCount: number; // 独立k线数量
  originIds: number[];
  originData: IFetchK[];
  startFenxing: IFenxing | null;
  endFenxing: IFenxing | null;
}

export interface IFetchChannel {
  zg: number; // 中枢上沿（最低的高点）
  zd: number; // 中枢下沿（最高的低点）
  gg: number; // 中枢最高（所有笔的最高点）
  dd: number; // 中枢最低（所有笔的最低点）
  level: ChannelLevel; // 中枢级别
  type: ChannelType; // 完成状态
  startId: number; // 起始K线索引
  endId: number; // 结束K线索引
  trend: TrendDirection; // 中枢趋势
  bis: IFetchBi[]; // 组成中枢的笔数组
  displayStartId: number; // 第一笔的中间位置K线ID
  displayEndId: number; // 最后一笔的中间位置K线ID
}

export type FenxingType = "top" | "bottom";

export const fetchMergeK = async (data: IFetchK[]): Promise<IMergeK[]> => {
  try {
    const response = await fetch(getPath(routes.MergeK), {
      method: "POST",
      body: JSON.stringify({ k: data }),
      headers: {
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(TIMEOUT),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching MergeK data:", error);
    throw new Error("Failed to fetch MergeK data");
  }
};

export const fetchBi = async (data: IFetchK[]): Promise<IFetchBi[]> => {
  try {
    const response = await fetch(getPath(routes.Bi), {
      method: "POST",
      body: JSON.stringify({ k: data }),
      headers: {
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(TIMEOUT),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching Bi data:", error);
    throw new Error("Failed to fetch Bi data");
  }
};

export const fetchFenxing = async (data: IFetchK[]): Promise<IFenxing[]> => {
  try {
    const response = await fetch(getPath(routes.Fenxing), {
      method: "POST",
      body: JSON.stringify({ k: data }),
      headers: {
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(TIMEOUT),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching Fenxing data:", error);
    throw new Error("Failed to fetch Fenxing data");
  }
};

export const fetchChannel = async (
  bi: IFetchBi[]
): Promise<IFetchChannel[]> => {
  try {
    const response = await fetch(getPath(routes.Channel), {
      method: "POST",
      body: JSON.stringify({ bi }),
      headers: {
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(TIMEOUT),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching Channel data:", error);
    throw new Error("Failed to fetch Channel data");
  }
};
