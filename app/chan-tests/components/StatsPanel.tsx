"use client";

import type { SnapshotMeta } from "../lib/load-snapshot";
import { formatShanghaiDateTime } from "@/app/lib/time";

interface StatsPanelProps {
  meta: SnapshotMeta | null;
}

export function StatsPanel({ meta }: StatsPanelProps) {
  if (!meta) {
    return (
      <div style={{ padding: 16, color: "var(--text-muted)" }}>
        该用例暂无快照。请运行{" "}
        <code>pnpm run snapshots:generate -- --case=&lt;key&gt;</code>
      </div>
    );
  }
  const s = meta.stats;
  const phaseABiCount = s.phaseABiCount ?? s.biCount;
  const phaseBBiCount = s.phaseBBiCount ?? s.biCount;
  const phaseAChannelCount = s.phaseAChannelCount ?? s.channelCount;
  const phaseBChannelCount = s.phaseBChannelCount ?? s.channelCount;
  return (
    <div
      style={{
        padding: 16,
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
        <Stat label="K线" value={s.kCount} />
        <Stat label="合并K" value={s.mergeKCount} />
        <Stat label="笔（Phase A）" value={phaseABiCount} />
        <Stat label="笔（Phase B）" value={phaseBBiCount} />
        <Stat label="中枢（Phase A）" value={phaseAChannelCount} />
        <Stat label="中枢（Phase B）" value={phaseBChannelCount} />
        <Stat label="分型" value={s.fenxingCount} />
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-muted)" }}>
        快照时间：{formatShanghaiDateTime(meta.generatedAt)} · 数据源：{
          meta.testCase.source
        } · 周期：{meta.testCase.period}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div
        className="tnum"
        style={{ fontSize: 20, fontWeight: 600, color: "var(--text-primary)" }}
      >
        {value}
      </div>
      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{label}</div>
    </div>
  );
}
