"use client";

import type { StrategyBacktestRun } from "@/app/api/client";
import { formatShanghaiShort } from "@/app/lib/time";

interface BacktestRunHistoryProps {
  runs: StrategyBacktestRun[];
  activeRunId: number | null;
  onSelectRun: (run: StrategyBacktestRun) => void;
}

const formatTimeShort = (value?: string | null) => {
  return formatShanghaiShort(value);
};

const getStatusBadgeClass = (status: string) => {
  switch (status) {
    case "completed":
      return "status-badge status-success";
    case "running":
      return "status-badge status-running";
    case "pending":
      return "status-badge status-pending";
    case "failed":
      return "status-badge status-failed";
    default:
      return "status-badge";
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case "completed":
      return "已完成";
    case "running":
      return "执行中";
    case "pending":
      return "排队中";
    case "failed":
      return "失败";
    default:
      return status;
  }
};

export function BacktestRunHistory({
  runs,
  activeRunId,
  onSelectRun,
}: BacktestRunHistoryProps) {
  return (
    <aside className="backtest-history-sidebar">
      <div className="strategy-section-title">
        <h2>回测任务记录</h2>
        <span>{runs.length} 个任务</span>
      </div>

      {runs.length === 0 ? (
        <p className="strategy-muted">暂无历史回测记录，请在上方发起。</p>
      ) : (
        <div className="backtest-run-list">
          {runs.map((run) => {
            const isSelected = run.id === activeRunId;
            return (
              <button
                key={run.id}
                type="button"
                className={`backtest-run-card ${isSelected ? "selected" : ""}`}
                onClick={() => onSelectRun(run)}
              >
                <div className="backtest-run-card-header">
                  <strong>#{run.id} · {run.targetUniverse.join(", ")}</strong>
                  <span className={getStatusBadgeClass(run.status)}>
                    {getStatusLabel(run.status)}
                  </span>
                </div>
                <div className="backtest-run-card-meta">
                  <span>{run.period}m · {run.source}</span>
                  <span className="tnum">信号: {run.signalCount} 个</span>
                </div>
                <div className="backtest-run-card-time">
                  <small>{formatTimeShort(run.startedAt || run.createdAt)}</small>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </aside>
  );
}
