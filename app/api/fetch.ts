import { getMockData } from "./mock-data";

export const BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8008";
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
}

export type FenxingType = "top" | "bottom";

export interface IFetchFenxing {
  type: "top" | "bottom";
  highest: number;
  lowest: number;
  leftIds: number[];
  middleIds: number[];
  rightIds: number[];
  middleIndex: number;
  middleOriginId: number;
}

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

// Helper function to safely convert time to ISO date string
const toISODateString = (time: Date | string): string => {
  if (typeof time === "string") {
    return time.split("T")[0];
  }
  return time.toISOString().split("T")[0];
};

/**
 * 计算分型（Fenxing）数据
 * 顶分型：中间K线高点最高，且高点>左右高点，低点>min(左右低点)
 * 底分型：中间K线低点最低，且低点<左右低点，高点<max(左右高点)
 */
export const calculateFenxings = (k: IFetchK[]): IFetchFenxing[] => {
  const fenxings: IFetchFenxing[] = [];

  for (let i = 1; i < k.length - 1; i++) {
    const prev = k[i - 1];
    const now = k[i];
    const next = k[i + 1];

    const isTop =
      now.highest > prev.highest &&
      now.highest > next.highest &&
      now.lowest > Math.min(prev.lowest, next.lowest);

    const isBottom =
      now.lowest < prev.lowest &&
      now.lowest < next.lowest &&
      now.highest < Math.max(prev.highest, next.highest);

    if (isTop) {
      fenxings.push({
        type: "top",
        index: i,
        date: toISODateString(now.time),
        price: now.highest,
        highest: now.highest,
        lowest: now.lowest,
        middleIndex: i,
      });
    } else if (isBottom) {
      fenxings.push({
        type: "bottom",
        index: i,
        date: toISODateString(now.time),
        price: now.lowest,
        highest: now.highest,
        lowest: now.lowest,
        middleIndex: i,
      });
    }
  }

  return fenxings;
};
