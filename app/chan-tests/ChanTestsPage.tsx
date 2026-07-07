"use client";

import { useMemo, useState } from "react";
import KPanel from "@/app/components/k-panel";
import type { CaseWithMeta, SnapshotData } from "./lib/load-snapshot";
import { CaseList } from "./components/CaseList";
import { StatsPanel } from "./components/StatsPanel";
import { snapshotToChart } from "./lib/snapshot-to-chart";

interface ChanTestsPageProps {
  cases: CaseWithMeta[];
  /** 预加载的快照数据，key → SnapshotData */
  snapshots: Record<string, SnapshotData>;
}

export function ChanTestsPage({ cases, snapshots }: ChanTestsPageProps) {
  const [selectedKey, setSelectedKey] = useState<string | null>(
    cases[0]?.testCase.key ?? null
  );

  const selectedCase = useMemo(
    () => cases.find((c) => c.testCase.key === selectedKey) ?? null,
    [cases, selectedKey]
  );

  const snap = selectedKey ? snapshots[selectedKey] ?? null : null;
  const meta = selectedCase?.meta ?? null;

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      <CaseList
        cases={cases}
        selectedKey={selectedKey}
        onSelect={setSelectedKey}
      />
      <main style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <header style={{ padding: 16, borderBottom: "1px solid #e5e7eb" }}>
          <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>
            缠论算法回归测试台
          </h1>
          {selectedCase && (
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6b7280" }}>
              {selectedCase.testCase.name} · {selectedCase.testCase.code}
            </p>
          )}
        </header>
        <StatsPanel meta={meta} />
        <div style={{ flex: 1, padding: 16, overflow: "auto" }}>
          {snap ? (
            <KPanelChartFromSnapshot snap={snap} />
          ) : (
            <div style={{ color: "#9ca3af" }}>该用例暂无快照数据。</div>
          )}
        </div>
      </main>
    </div>
  );
}

/** 用快照数据驱动 KPanel */
function KPanelChartFromSnapshot({ snap }: { snap: SnapshotData }) {
  const chart = useMemo(() => snapshotToChart(snap), [snap]);
  // KPanel 期望 mergeK/bi/fenxing/channel 为 Promise（实时页是异步获取）。
  // 快照已就绪，直接包成已 resolve 的 Promise。
  return (
    <KPanel
      k={chart.k}
      mergeK={Promise.resolve(chart.mergeK)}
      bi={Promise.resolve(chart.bi)}
      fenxing={Promise.resolve(chart.fenxing)}
      channel={Promise.resolve(chart.channel)}
    />
  );
}
