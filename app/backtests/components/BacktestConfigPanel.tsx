"use client";

import { useState } from "react";
import type {
  DataSourceValue,
  StrategyDefinition,
  StrategyVersion,
} from "@/app/api/client";

export interface BacktestConfigValues {
  strategyVersionId: number;
  targetUniverse: string[];
  period: number;
  source: DataSourceValue;
  startDate: string;
  endDate: string;
}

interface BacktestConfigPanelProps {
  strategies: StrategyDefinition[];
  versions: StrategyVersion[];
  selectedStrategyId: number | null;
  onSelectStrategyId: (id: number) => void;
  isRunning: boolean;
  onSubmit: (values: BacktestConfigValues) => void;
}

const DEFAULT_CODE = "000001";
const DEFAULT_PERIOD = 5;
const DEFAULT_SOURCE: DataSourceValue = "tdx";

function getDefaultDates() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const dateStr = `${year}-${month}-${day}`;

  return {
    start: `${dateStr}T09:30:00`,
    end: `${dateStr}T15:00:00`,
  };
}

export function BacktestConfigPanel({
  strategies,
  versions,
  selectedStrategyId,
  onSelectStrategyId,
  isRunning,
  onSubmit,
}: BacktestConfigPanelProps) {
  const [targetCode, setTargetCode] = useState(DEFAULT_CODE);
  const [period, setPeriod] = useState(DEFAULT_PERIOD);
  const [source, setSource] = useState<DataSourceValue>(DEFAULT_SOURCE);
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);

  const defaultDates = getDefaultDates();
  const [startDateTime, setStartDateTime] = useState(defaultDates.start);
  const [endDateTime, setEndDateTime] = useState(defaultDates.end);
  const [formError, setFormError] = useState("");

  const activeVersionId = selectedVersionId ?? (versions[0]?.id ?? null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!activeVersionId) {
      setFormError("请选择策略版本");
      return;
    }
    if (!targetCode.trim()) {
      setFormError("请输入标的代码（如 000001）");
      return;
    }
    if (!startDateTime || !endDateTime) {
      setFormError("请选择完整的开始与结束时间");
      return;
    }
    if (new Date(startDateTime) > new Date(endDateTime)) {
      setFormError("开始时间不能晚于结束时间");
      return;
    }

    const targets = targetCode
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    // Format ISO string with time
    const startIso = new Date(startDateTime).toISOString();
    const endIso = new Date(endDateTime).toISOString();

    onSubmit({
      strategyVersionId: activeVersionId,
      targetUniverse: targets,
      period,
      source,
      startDate: startIso,
      endDate: endIso,
    });
  };

  return (
    <form className="backtest-config-panel" onSubmit={handleSubmit}>
      <div className="backtest-config-header">
        <h2>发起回测任务</h2>
        <span className="strategy-muted">支持精确至分秒的区间回测</span>
      </div>

      <div className="backtest-form-grid">
        <label className="field">
          策略定义
          <select
            value={selectedStrategyId ?? ""}
            onChange={(e) => onSelectStrategyId(Number(e.target.value))}
          >
            {strategies.map((strat) => (
              <option key={strat.id} value={strat.id}>
                #{strat.id} {strat.name} ({strat.status})
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          策略版本
          <select
            value={activeVersionId ?? ""}
            onChange={(e) => setSelectedVersionId(Number(e.target.value))}
          >
            {versions.map((ver) => (
              <option key={ver.id} value={ver.id}>
                版本 v{ver.versionNumber} ({ver.signalKind})
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          标的代码
          <input
            placeholder="如 000001, 600519"
            value={targetCode}
            onChange={(e) => setTargetCode(e.target.value.trim())}
          />
        </label>

        <label className="field">
          K 线级别 / 周期
          <select
            value={period}
            onChange={(e) => setPeriod(Number(e.target.value))}
          >
            <option value={1}>1 分钟</option>
            <option value={5}>5 分钟</option>
            <option value={15}>15 分钟</option>
            <option value={30}>30 分钟</option>
            <option value={60}>60 分钟</option>
            <option value={1440}>日线 (1440m)</option>
          </select>
        </label>

        <label className="field">
          数据源
          <select
            value={source}
            onChange={(e) => setSource(e.target.value as DataSourceValue)}
          >
            <option value="tdx">TDX</option>
            <option value="qmt">QMT</option>
            <option value="ef">东方财富</option>
          </select>
        </label>

        <label className="field">
          开始时间 (含时分秒)
          <input
            type="datetime-local"
            step="1"
            value={startDateTime}
            onChange={(e) => setStartDateTime(e.target.value)}
          />
        </label>

        <label className="field">
          结束时间 (含时分秒)
          <input
            type="datetime-local"
            step="1"
            value={endDateTime}
            onChange={(e) => setEndDateTime(e.target.value)}
          />
        </label>
      </div>

      {formError ? <p className="strategy-error">{formError}</p> : null}

      <div className="backtest-form-actions">
        <button
          className="primary-action"
          type="submit"
          disabled={isRunning}
        >
          {isRunning ? "回测执行中…" : "发起回测"}
        </button>
      </div>
    </form>
  );
}
