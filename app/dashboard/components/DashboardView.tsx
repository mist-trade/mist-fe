"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { RangeKey } from "../lib/types";
import {
  getKpiMetrics,
  getEquitySeries,
  getDrawdownSeries,
  getPositions,
} from "../data/mock";
import { useConnectionStatus } from "@/app/lib/swr/useConnectionStatus";
import { KpiCard } from "./KpiCard";
import { PositionsTable } from "./PositionsTable";
import { ConnectionBadge } from "./ConnectionBadge";
import { DataFreshnessLabel } from "./DataFreshnessLabel";
import { RangeSwitcher } from "./RangeSwitcher";

// 懒加载图表组件（含 echarts/core），不进首屏 bundle
const EquityChart = dynamic(
  () => import("./EquityChart").then((m) => m.EquityChart),
  { ssr: false, loading: () => <ChartLoading height={320} /> }
);
const DrawdownChart = dynamic(
  () => import("./DrawdownChart").then((m) => m.DrawdownChart),
  { ssr: false, loading: () => <ChartLoading height={200} /> }
);

/**
 * Dashboard 概览视图：设计系统的样板装配。
 *
 * 布局（桌面优先，max-width 1440）：
 *  顶部状态条（连接/新鲜度/范围切换）
 *  KPI 卡片行（5 个）
 *  主区：左侧权益曲线 + 回撤（2/3 宽），右侧持仓表（1/3 宽）
 *
 * 响应式：<1280 两栏堆叠，<768 单栏。
 */
export function DashboardView() {
  const [range, setRange] = useState<RangeKey>("3M");
  // 实时连接状态（延迟探测 + SWR 错误事件驱动），后端就绪前探测端点可能 404，
  // useConnectionStatus 内部回退为 online，不阻断 UI。
  const connection = useConnectionStatus();
  const positions = useMemo(() => getPositions(), []);

  const kpis = useMemo(() => getKpiMetrics(range), [range]);
  const equity = useMemo(() => getEquitySeries(range), [range]);
  const drawdown = useMemo(() => getDrawdownSeries(range), [range]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--surface-base)",
        color: "var(--text-primary)",
        padding: 24,
        maxWidth: 1440,
        margin: "0 auto",
      }}
    >
      {/* 标题 + 状态条 */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 20,
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 600,
              color: "var(--text-primary)",
            }}
          >
            组合监控
          </h1>
          <div style={{ marginTop: 6 }}>
            <DataFreshnessLabel status={connection} />
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <RangeSwitcher value={range} onChange={setRange} />
          <ConnectionBadge status={connection} />
        </div>
      </header>

      {/* KPI 行 */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 12,
          marginBottom: 20,
        }}
      >
        {kpis.map((m) => (
          <KpiCard key={m.key} metric={m} />
        ))}
      </section>

      {/* 主区：图表 + 持仓 */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 2fr) minmax(360px, 1fr)",
          gap: 16,
          alignItems: "start",
        }}
        className="dashboard-main"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Panel title="累计收益 vs 基准">
            <EquityChart data={equity} />
          </Panel>
          <Panel title="回撤">
            <DrawdownChart data={drawdown} />
          </Panel>
        </div>
        <Panel title="持仓快照">
          <PositionsTable data={positions} />
        </Panel>
      </section>

      <style>{responsiveStyle}</style>
    </div>
  );
}

/** 面板：标题 + 内容，统一卡片样式。 */
function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "var(--surface-raised)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 8,
        boxShadow: "var(--shadow-card)",
        padding: 16,
        minWidth: 0,
      }}
    >
      <h2
        style={{
          margin: "0 0 12px",
          fontSize: 14,
          fontWeight: 600,
          color: "var(--text-secondary)",
        }}
      >
        {title}
      </h2>
      {children}
    </div>
  );
}

function ChartLoading({ height }: { height: number }) {
  return (
    <div
      style={{
        height,
        background: "var(--surface-raised)",
        borderRadius: 8,
        animation: "mist-shimmer 1.5s infinite",
      }}
      aria-label="图表加载中"
    />
  );
}

const responsiveStyle = `
@keyframes mist-shimmer {
  0% { opacity: 0.6; }
  50% { opacity: 0.9; }
  100% { opacity: 0.6; }
}
@media (max-width: 1279px) {
  .dashboard-main {
    grid-template-columns: 1fr !important;
  }
}
@media (max-width: 767px) {
  .dashboard-main > div:first-child > div {
    /* 图表面板移动端仍纵向堆叠 */
  }
}
`;
