import {
  TrendDirection,
  BiType,
  BiStatus,
  ChannelType,
  ChannelLevel,
  ChannelStatus,
  type IFetchK,
  type IMergeK,
  type IFetchBi,
  type IFetchChannel,
  type IFenxing,
  type FenxingType,
} from "@/app/api/types";
import type { VisualCommandVo } from "@/app/api/client";
import type { SnapshotData } from "./load-snapshot";

export interface ChartBiPhases {
  phaseA: IFetchBi[];
  phaseB: IFetchBi[];
}

export interface ChartChannelPhases {
  phaseA: IFetchChannel[];
  phaseB: IFetchChannel[];
}

export interface ChartData {
  k: IFetchK[];
  mergeK: IMergeK[];
  bi: ChartBiPhases;
  fenxing: IFenxing[];
  channel: ChartChannelPhases;
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

function asChannelStatus(v: unknown): ChannelStatus {
  const n = typeof v === "number" ? v : Number(v);
  if (n === 1) return ChannelStatus.Valid;
  if (n === 2) return ChannelStatus.Invalid;
  return ChannelStatus.Unknown;
}

function asFenxingType(v: unknown): FenxingType {
  return v === "top" ? "top" : "bottom";
}

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
  const channelRaw = snap.channel as
    | IFetchChannel[]
    | { phaseA: IFetchChannel[]; phaseB: IFetchChannel[] };
  const normalizeChannel = (x: IFetchChannel) => ({
    ...x,
    trend: asTrend(x.trend),
    type: asChannelType(x.type),
    level: asChannelLevel(x.level),
    status: asChannelStatus(x.status),
    bis: (x.bis ?? []).map(asBi),
  });
  const channel = Array.isArray(channelRaw)
    ? {
        phaseA: channelRaw.map(normalizeChannel),
        phaseB: channelRaw.map(normalizeChannel),
      }
    : {
        phaseA: channelRaw.phaseA.map(normalizeChannel),
        phaseB: channelRaw.phaseB.map(normalizeChannel),
      };
  return { k, mergeK, bi, fenxing, channel };
}

export function snapshotToVisualCommands(
  snap: SnapshotData,
  phase: "phaseA" | "phaseB" = "phaseB"
): { k: IFetchK[]; commands: VisualCommandVo[] } {
  const chart = snapshotToChart(snap);
  const commands: VisualCommandVo[] = [];

  const biList = chart.bi[phase] || [];
  biList.forEach((b, idx) => {
    const isUp = b.trend === TrendDirection.Up;
    commands.push({
      id: `snap_bi_${phase}_${idx}`,
      type: "line",
      layer: "chan_bi",
      startTime: String(b.startTime),
      endTime: String(b.endTime),
      startPrice: isUp ? b.low : b.high,
      endPrice: isUp ? b.high : b.low,
      color: "#FACC15",
      width: 1,
      style: "solid",
    });
  });

  const channelList = chart.channel[phase] || [];
  channelList.forEach((c, idx) => {
    const firstBi = c.bis[0];
    const lastBi = c.bis[c.bis.length - 1];
    if (firstBi && lastBi) {
      commands.push({
        id: `snap_zs_${phase}_${idx}`,
        type: "band",
        layer: "chan_zs_bi",
        fromTime: String(firstBi.startTime),
        toTime: String(lastBi.endTime),
        top: c.zg,
        bottom: c.zd,
        gg: c.gg,
        dd: c.dd,
        color: "#38BDF8",
        fill: true,
      });
    }
  });

  return { k: chart.k, commands };
}

