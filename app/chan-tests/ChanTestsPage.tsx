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

type BiPhase = "phaseA" | "phaseB";

export function ChanTestsPage({ cases, snapshots }: ChanTestsPageProps) {
  const [selectedKey, setSelectedKey] = useState<string | null>(
    cases[0]?.testCase.key ?? null
  );
  const [selectedPhase, setSelectedPhase] = useState<BiPhase>("phaseB");

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
          <div
            aria-label="笔归约阶段"
            role="group"
            style={{ display: "flex", gap: 8, marginTop: 12 }}
          >
            {([
              ["phaseA", "Phase A 原始"],
              ["phaseB", "Phase B 归约"],
            ] as const).map(([phase, label]) => (
              <button
                aria-pressed={selectedPhase === phase}
                key={phase}
                onClick={() => setSelectedPhase(phase)}
                style={{
                  background: selectedPhase === phase ? "#2563eb" : "#f3f4f6",
                  border: "none",
                  borderRadius: 6,
                  color: selectedPhase === phase ? "#fff" : "#374151",
                  cursor: "pointer",
                  padding: "6px 10px",
                }}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
        </header>
        <StatsPanel meta={meta} />
        <div style={{ flex: 1, padding: 16, overflow: "auto" }}>
          {snap ? (
            <KPanelChartFromSnapshot snap={snap} selectedPhase={selectedPhase} />
          ) : (
            <div style={{ color: "#9ca3af" }}>该用例暂无快照数据。</div>
          )}
        </div>
      </main>
    </div>
  );
}

/** 用快照数据驱动 KPanel */
function KPanelChartFromSnapshot({
  snap,
  selectedPhase,
}: {
  snap: SnapshotData;
  selectedPhase: BiPhase;
}) {
  const chart = useMemo(() => snapshotToChart(snap), [snap]);
  // KPanel 期望 mergeK/bi/fenxing/channel 为 Promise（实时页是异步获取）。
  // 快照已就绪，直接包成已 resolve 的 Promise。
  return (
    <KPanel
      k={chart.k}
      mergeK={Promise.resolve(chart.mergeK)}
      bi={Promise.resolve(chart.bi[selectedPhase])}
      fenxing={Promise.resolve(chart.fenxing)}
      channel={Promise.resolve(chart.channel[selectedPhase])}
    />
  );
}
