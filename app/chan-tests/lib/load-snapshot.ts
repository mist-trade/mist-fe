import fs from "fs";
import path from "path";
import { chanTestCases, type ChanTestCase } from "@/__fixtures__/cases";

const SNAPSHOTS_ROOT = path.join(
  process.cwd(),
  "__fixtures__",
  "snapshots",
  "chan"
);

export interface SnapshotStats {
  kCount: number;
  mergeKCount: number;
  biCount: number;
  phaseABiCount?: number;
  phaseBBiCount?: number;
  channelCount: number;
  fenxingCount: number;
}

export interface SnapshotMeta {
  key: string;
  name: string;
  generatedAt: string;
  testCase: {
    code: string;
    source: string;
    period: number;
    startDate: string;
    endDate: string;
  };
  stats: SnapshotStats;
}

export interface CaseWithMeta {
  testCase: ChanTestCase;
  meta: SnapshotMeta | null; // null = 该用例还没生成快照
}

/** 列出所有用例及其快照 meta（无快照的 meta 为 null） */
export function listCasesWithMeta(): CaseWithMeta[] {
  return chanTestCases.map((testCase) => ({
    testCase,
    meta: readMeta(testCase.key),
  }));
}

function readMeta(key: string): SnapshotMeta | null {
  const metaPath = path.join(SNAPSHOTS_ROOT, key, "meta.json");
  try {
    const raw = fs.readFileSync(metaPath, "utf-8");
    return JSON.parse(raw) as SnapshotMeta;
  } catch {
    return null;
  }
}

export interface SnapshotData {
  meta: SnapshotMeta;
  k: unknown[];
  mergeK: unknown[];
  bi: SnapshotBiData;
  fenxing: unknown[];
  channel: unknown[];
}

export interface SnapshotBiData {
  phaseA: unknown[];
  phaseB: unknown[];
}

export function normalizeSnapshotBiData(value: unknown): SnapshotBiData {
  if (Array.isArray(value)) return { phaseA: value, phaseB: value };
  if (
    value &&
    typeof value === "object" &&
    Array.isArray((value as { phaseA?: unknown }).phaseA) &&
    Array.isArray((value as { phaseB?: unknown }).phaseB)
  ) {
    const { phaseA, phaseB } = value as {
      phaseA: unknown[];
      phaseB: unknown[];
    };
    return { phaseA, phaseB };
  }
  throw new Error("bi.json 必须是数组，或包含 phaseA 和 phaseB 数组的对象");
}

/** 读取某用例的完整快照数据 */
export function readSnapshot(key: string): SnapshotData | null {
  const dir = path.join(SNAPSHOTS_ROOT, key);
  const meta = readMeta(key);
  if (!meta) return null;
  try {
    return {
      meta,
      k: readJson(dir, "k.json"),
      mergeK: readJson(dir, "merge-k.json"),
      bi: normalizeSnapshotBiData(readJson(dir, "bi.json")),
      fenxing: readJson(dir, "fenxing.json"),
      channel: readJson(dir, "channel.json"),
    };
  } catch {
    return null;
  }
}

function readJson<T = unknown>(dir: string, file: string): T {
  const raw = fs.readFileSync(path.join(dir, file), "utf-8");
  return JSON.parse(raw) as T;
}
