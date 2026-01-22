import { mockKData } from "./mock";

export const BASE = "http://127.0.0.1:3001";

const getPath = (path: string) => `${BASE}${path}`;

const routes = {
  K: "/indicator/k",
  MACD: "/indicator/macd",
  RSI: "/indicator/rsi",
  KDJ: "/indicator/kdj",
  MergeK: "/chan/merge-k",
  Bi: "/chan/bi",
};

export interface IFetchK {
  id: number;
  symbol: string;
  time: Date;
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
  return fetch(getPath(routes.K), {
    method: "POST",
    body: JSON.stringify(data),
    headers: {
      "Content-Type": "application/json",
    },
  }).then(() => mockKData);
  // .catch(() => mockKData);
};

export enum TrendDirection {
  Up = "up",
  Down = "down",
  None = "none", // 无趋势
}

export enum BiType {
  Initial = "initial",
  UnComplete = "uncomplete",
  Complete = "complete",
}

export interface IMergeK {
  startTime: Date;
  endTime: Date;
  highest: number;
  lowest: number;
  trend: TrendDirection;
  mergedCount: number;
  mergedIds: number[];
  mergedData: IFetchK[];
}

export interface IFetchBi {
  startTime: Date;
  endTime: Date;
  highest: number;
  lowest: number;
  trend: TrendDirection;
  type: BiType;
  independentCount: number; // 独立k线数量
  originIds: number[];
  originData: IFetchK[];
}

export const fetchMergeK = async (data: IFetchK[]): Promise<IMergeK[]> => {
  return fetch(getPath(routes.MergeK), {
    method: "POST",
    body: JSON.stringify({ k: data }),
    headers: {
      "Content-Type": "application/json",
    },
  }).then((res) => res.json());
};

export const fetchBi = async (data: IFetchK[]): Promise<IFetchBi[]> => {
  return fetch(getPath(routes.Bi), {
    method: "POST",
    body: JSON.stringify({ k: data }),
    headers: {
      "Content-Type": "application/json",
    },
  }).then((res) => res.json());
};
