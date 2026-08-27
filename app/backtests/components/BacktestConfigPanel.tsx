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

const PRESET_STOCKS = [
  { code: "600519", name: "贵州茅台" },
  { code: "000001", name: "平安银行" },
  { code: "300750", name: "宁德时代" },
  { code: "002594", name: "比亚迪" },
];

function formatLocalDateTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

function getDefaultDates() {
  const now = new Date();
  const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 3600 * 1000);
  return {
    start: formatLocalDateTime(threeMonthsAgo),
    end: formatLocalDateTime(now),
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

  const activeVersion =
    versions.find((v) => v.id === selectedVersionId) ?? versions[0];
  const activeVersionId = activeVersion?.id ?? null;

  // 快捷设置时间范围
  const handleQuickRange = (days: number | "ytd") => {
    const end = new Date();
    let start: Date;
    if (days === "ytd") {
      start = new Date(end.getFullYear(), 0, 1, 9, 30, 0);
    } else {
      start = new Date(end.getTime() - days * 24 * 3600 * 1000);
      start.setHours(9, 30, 0, 0);
    }
    end.setHours(15, 0, 0, 0);
    setStartDateTime(formatLocalDateTime(start));
    setEndDateTime(formatLocalDateTime(end));
  };

  const handleSelectPresetStock = (code: string) => {
    if (!targetCode) {
      setTargetCode(code);
    } else {
      const currentList = targetCode.split(",").map((s) => s.trim()).filter(Boolean);
      if (!currentList.includes(code)) {
        setTargetCode([...currentList, code].join(", "));
      }
    }
  };

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
        <span className="strategy-muted">支持多标的与精确至分秒的区间回测</span>
      </div>

      <div className="backtest-form-grid">
        <label className="field">
          策略定义
          <select
            value={selectedStrategyId ?? ""}
            onChange={(e) => {
              setSelectedVersionId(null);
              onSelectStrategyId(Number(e.target.value));
            }}
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

        <div className="field">
          <label htmlFor="target-code-input">标的代码 (支持逗号分隔多标的)</label>
          <input
            id="target-code-input"
            placeholder="如 000001, 600519"
            value={targetCode}
            onChange={(e) => setTargetCode(e.target.value)}
          />
          <div className="quick-presets-row">
            {PRESET_STOCKS.map((stock) => (
              <button
                key={stock.code}
                type="button"
                className="quick-preset-btn"
                onClick={() => handleSelectPresetStock(stock.code)}
              >
                + {stock.name}
              </button>
            ))}
          </div>
        </div>

        <div className="field-row-2">
          <label className="field">
            K 线周期
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
        </div>

        <div className="field">
          <label>回测快捷区间</label>
          <div className="quick-presets-row">
            <button type="button" className="quick-preset-btn" onClick={() => handleQuickRange(7)}>近1周</button>
            <button type="button" className="quick-preset-btn" onClick={() => handleQuickRange(30)}>近1月</button>
            <button type="button" className="quick-preset-btn" onClick={() => handleQuickRange(90)}>近3月</button>
            <button type="button" className="quick-preset-btn" onClick={() => handleQuickRange(180)}>近半年</button>
            <button type="button" className="quick-preset-btn" onClick={() => handleQuickRange(365)}>近1年</button>
            <button type="button" className="quick-preset-btn" onClick={() => handleQuickRange("ytd")}>今年以来</button>
          </div>
        </div>

        <div className="field-row-2">
          <label className="field">
            开始时间
            <input
              type="datetime-local"
              step="1"
              value={startDateTime}
              onChange={(e) => setStartDateTime(e.target.value)}
            />
          </label>

          <label className="field">
            结束时间
            <input
              type="datetime-local"
              step="1"
              value={endDateTime}
              onChange={(e) => setEndDateTime(e.target.value)}
            />
          </label>
        </div>
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

export default BacktestConfigPanel;
