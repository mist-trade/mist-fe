"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { CaseWithMeta, SnapshotData } from "./lib/load-snapshot";
import { CaseList } from "./components/CaseList";
import { StatsPanel } from "./components/StatsPanel";
import { snapshotToVisualCommands } from "./lib/snapshot-to-chart";

// 懒加载 TradingViewChart，不进首屏 SSR
const TradingViewChart = dynamic(
  () => import("@/app/components/tv-chart/TradingViewChart"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[550px] flex items-center justify-center bg-surface-raised rounded-lg text-text-muted animate-pulse">
        加载 TradingView 快照图表...
      </div>
    ),
  }
);

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
            <TradingViewChartFromSnapshot snap={snap} selectedPhase={selectedPhase} />
          ) : (
            <div style={{ color: "#9ca3af" }}>该用例暂无快照数据。</div>
          )}
        </div>
      </main>
    </div>
  );
}

/** 用快照数据驱动 TradingViewChart */
function TradingViewChartFromSnapshot({
  snap,
  selectedPhase,
}: {
  snap: SnapshotData;
  selectedPhase: BiPhase;
}) {
  const { k, commands } = useMemo(
    () => snapshotToVisualCommands(snap, selectedPhase),
    [snap, selectedPhase]
  );

  return <TradingViewChart k={k} commands={commands} height={550} />;
}

export default ChanTestsPage;
