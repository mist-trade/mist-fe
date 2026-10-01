import { memo } from "react";
import type { StrategyBacktestRun } from "@/app/api/client";
import { formatShanghaiDate } from "@/app/lib/time";

interface BacktestMetricsBarProps {
  activeRun: StrategyBacktestRun;
  selectedSymbol: string;
  signalCount: number;
  showVolume: boolean;
  onToggleVolume: () => void;
}

export const BacktestMetricsBar = memo(function BacktestMetricsBar({
  activeRun,
  selectedSymbol,
  signalCount,
  showVolume,
  onToggleVolume,
}: BacktestMetricsBarProps) {
  return (
    <div className="backtest-metrics-bar">
      <div className="metrics-bar-left">
        <strong>#{activeRun.id} 回测复盘</strong>
        <span className="info-pill">{selectedSymbol || activeRun.targetUniverse?.[0]}</span>
        <span className="info-pill">{activeRun.period} 分钟</span>
        <span className="info-pill">{activeRun.source.toUpperCase()}</span>
        <span className="info-pill tnum">
          {formatShanghaiDate(activeRun.startDate)} ~ {formatShanghaiDate(activeRun.endDate)}
        </span>
        <span className="signal-count-badge">🎯 命中信号: {signalCount} 个</span>
      </div>

      <div className="subchart-toggle">
        <button
          type="button"
          className={showVolume ? "active" : ""}
          onClick={onToggleVolume}
        >
          {showVolume ? "📊 成交量 (显示中)" : "📊 成交量 (已隐藏)"}
        </button>
      </div>
    </div>
  );
});
