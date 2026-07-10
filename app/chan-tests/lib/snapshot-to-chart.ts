import {
  TrendDirection,
  BiType,
  BiStatus,
  ChannelType,
  ChannelLevel,
  type IFetchK,
  type IMergeK,
  type IFetchBi,
  type IFetchChannel,
  type IFenxing,
  type FenxingType,
} from "@/app/api/types";
import type { SnapshotData } from "./load-snapshot";

/**
 * 把快照 JSON 转成 KPanel 期望的类型。
 * 快照是后端 API 原样返回，字段名一致，仅需把 string enum / string date 归一化。
 */

export interface ChartBiPhases {
  phaseA: IFetchBi[];
  phaseB: IFetchBi[];
}

export interface ChartData {
  k: IFetchK[];
  mergeK: IMergeK[];
  bi: ChartBiPhases;
  fenxing: IFenxing[];
  channel: IFetchChannel[];
}

function asTrend(v: unknown): TrendDirection {
  if (v === "up" || v === TrendDirection.Up) return TrendDirection.Up;
  if (v === "down" || v === TrendDirection.Down) return TrendDirection.Down;
  return TrendDirection.None;
}

function asBiType(v: unknown): BiType {
  return v === "complete" || v === BiType.Complete
    ? BiType.Complete
    : BiType.UnComplete;
}

function asBiStatus(v: unknown): BiStatus {
  const n = typeof v === "number" ? v : Number(v);
  if (n === 1) return BiStatus.Valid;
  if (n === 2) return BiStatus.Invalid;
  return BiStatus.Unknown;
}

function asChannelType(v: unknown): ChannelType {
  return v === "complete" || v === ChannelType.Complete
    ? ChannelType.Complete
    : ChannelType.UnComplete;
}

function asChannelLevel(v: unknown): ChannelLevel {
  return v === "duan" || v === ChannelLevel.Duan
    ? ChannelLevel.Duan
    : ChannelLevel.Bi;
}

function asFenxingType(v: unknown): FenxingType {
  return v === "top" ? "top" : "bottom";
}

/** 归一化单个 bi（channel.bis 复用） */
function asBi(x: IFetchBi): IFetchBi {
  return {
    ...x,
    trend: asTrend(x.trend),
    type: asBiType(x.type),
    status: asBiStatus(x.status),
    originData: (x.originData ?? []).map((d) => ({ ...d })),
    startFenxing: x.startFenxing
      ? { ...x.startFenxing, type: asFenxingType(x.startFenxing.type) }
      : null,
    endFenxing: x.endFenxing
      ? { ...x.endFenxing, type: asFenxingType(x.endFenxing.type) }
      : null,
  };
}

export function snapshotToChart(snap: SnapshotData): ChartData {
  const k = (snap.k as IFetchK[]).map((x) => ({ ...x }));
  const mergeK = (snap.mergeK as IMergeK[]).map((x) => ({
    ...x,
    trend: asTrend(x.trend),
    mergedData: (x.mergedData ?? []).map((d) => ({ ...d })),
  }));
  const bi = {
    phaseA: (snap.bi.phaseA as IFetchBi[]).map(asBi),
    phaseB: (snap.bi.phaseB as IFetchBi[]).map(asBi),
  };
  const fenxing = (snap.fenxing as IFenxing[]).map((x) => ({
    ...x,
    type: asFenxingType(x.type),
  }));
  const channel = (snap.channel as IFetchChannel[]).map((x) => ({
    ...x,
    trend: asTrend(x.trend),
    type: asChannelType(x.type),
    level: asChannelLevel(x.level),
    bis: (x.bis ?? []).map(asBi),
  }));
  return { k, mergeK, bi, fenxing, channel };
}
