"use client";

import type { SnapshotMeta } from "../lib/load-snapshot";

interface StatsPanelProps {
  meta: SnapshotMeta | null;
}

export function StatsPanel({ meta }: StatsPanelProps) {
  if (!meta) {
    return (
      <div style={{ padding: 16, color: "#9ca3af" }}>
        该用例暂无快照。请运行{" "}
        <code>pnpm run snapshots:generate -- --case=&lt;key&gt;</code>
      </div>
    );
  }
  const s = meta.stats;
  return (
    <div style={{ padding: 16, borderBottom: "1px solid #e5e7eb" }}>
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
        <Stat label="K线" value={s.kCount} />
        <Stat label="合并K" value={s.mergeKCount} />
        <Stat label="笔" value={s.biCount} />
        <Stat label="中枢" value={s.channelCount} />
        <Stat label="分型" value={s.fenxingCount} />
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280" }}>
        快照时间：{new Date(meta.generatedAt).toLocaleString("zh-CN")} · 数据源：{
          meta.testCase.source
        } · 周期：{meta.testCase.period}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 600 }}>{value}</div>
      <div style={{ fontSize: 12, color: "#6b7280" }}>{label}</div>
    </div>
  );
}
