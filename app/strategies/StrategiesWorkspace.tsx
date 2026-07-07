"use client";

import { useEffect, useMemo, useState } from "react";
import {
  acknowledgeStrategyAlertEvent,
  createStrategyBacktest,
  createStrategyDefinition,
  disableStrategyDefinition,
  enableStrategyDefinition,
  fetchStrategyAlertEvents,
  fetchStrategyBacktestSignals,
  fetchStrategySignals,
  listStrategies,
  listStrategyVersions,
  runStrategyScan,
  updateStrategyDefinition,
  type BacktestRunStatus,
  type DataSourceValue,
  type StrategyAlertEvent,
  type StrategyBacktestRun,
  type StrategyBacktestSignalResult,
  type StrategyDefinition,
  type StrategySignal,
  type StrategyVersion,
} from "@/app/api/client";

type StrategyTab = "registry" | "signals" | "alerts" | "backtests";

const DEFAULT_RULE = {
  field: "k.close",
  operator: "gt",
  value: 100,
};

const formatJson = (value: unknown) => JSON.stringify(value ?? {}, null, 2);

const parseCsv = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const parseNumberCsv = (value: string) =>
  parseCsv(value)
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item));

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  return value.replace("T", " ").replace(".000Z", "");
};

const statusLabel = (status?: string) => status || "-";

export default function StrategiesWorkspace() {
  const [activeTab, setActiveTab] = useState<StrategyTab>("registry");
  const [strategies, setStrategies] = useState<StrategyDefinition[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [versions, setVersions] = useState<StrategyVersion[]>([]);
  const [signals, setSignals] = useState<StrategySignal[]>([]);
  const [alerts, setAlerts] = useState<StrategyAlertEvent[]>([]);
  const [backtestRun, setBacktestRun] = useState<StrategyBacktestRun | null>(null);
  const [backtestSignals, setBacktestSignals] = useState<StrategyBacktestSignalResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isActionRunning, setIsActionRunning] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [editorError, setEditorError] = useState("");
  const [scanResult, setScanResult] = useState("");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [targetUniverse, setTargetUniverse] = useState("");
  const [periods, setPeriods] = useState("1440");
  const [sources, setSources] = useState("tdx");
  const [ruleText, setRuleText] = useState(formatJson(DEFAULT_RULE));

  const [backtestVersionId, setBacktestVersionId] = useState("");
  const [backtestUniverse, setBacktestUniverse] = useState("");
  const [backtestPeriod, setBacktestPeriod] = useState("1440");
  const [backtestSource, setBacktestSource] = useState<DataSourceValue>("tdx");
  const [backtestStartDate, setBacktestStartDate] = useState("");
  const [backtestEndDate, setBacktestEndDate] = useState("");

  const selectedStrategy = useMemo(
    () => strategies.find((item) => item.id === selectedId) || null,
    [selectedId, strategies]
  );

  const currentVersion = useMemo(
    () =>
      versions.find((item) => item.id === selectedStrategy?.currentVersionId) ||
      versions[0] ||
      null,
    [selectedStrategy?.currentVersionId, versions]
  );

  const refreshStrategies = async () => {
    const items = await listStrategies();
    setStrategies(items);
    setSelectedId((current) => current ?? items[0]?.id ?? null);
    return items;
  };

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    Promise.all([
      refreshStrategies(),
      fetchStrategySignals(),
      fetchStrategyAlertEvents(),
    ])
      .then(([, signalItems, alertItems]) => {
        if (!active) return;
        setSignals(signalItems);
        setAlerts(alertItems);
        setLoadError("");
      })
      .catch((error) => {
        if (!active) return;
        setLoadError(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setVersions([]);
      return;
    }

    let active = true;
    listStrategyVersions(selectedId)
      .then((items) => {
        if (!active) return;
        setVersions(items);
      })
      .catch((error) => {
        if (!active) return;
        setLoadError(error instanceof Error ? error.message : String(error));
      });
    return () => {
      active = false;
    };
  }, [selectedId]);

  useEffect(() => {
    if (!selectedStrategy) return;
    setName(selectedStrategy.name);
    setDescription(selectedStrategy.description || "");
    setTargetUniverse(selectedStrategy.targetUniverse.join(", "));
    setPeriods(selectedStrategy.periods.join(", "));
    setSources(selectedStrategy.sources.join(", "));
    setBacktestVersionId(String(selectedStrategy.currentVersionId || ""));
    setBacktestUniverse(selectedStrategy.targetUniverse.join(", "));
  }, [selectedStrategy]);

  useEffect(() => {
    if (!currentVersion) return;
    setRuleText(formatJson(currentVersion.rule));
  }, [currentVersion]);

  const parseRule = () => {
    try {
      return JSON.parse(ruleText) as Record<string, unknown>;
    } catch {
      throw new Error("规则 JSON 格式错误");
    }
  };

  const saveStrategy = async () => {
    setEditorError("");
    let rule: Record<string, unknown>;
    try {
      rule = parseRule();
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : String(error));
      return;
    }

    setIsSaving(true);
    try {
      await createStrategyDefinition({
        name,
        description,
        targetUniverse: parseCsv(targetUniverse),
        periods: parseNumberCsv(periods),
        sources: parseCsv(sources) as DataSourceValue[],
        rule,
      });
      await refreshStrategies();
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSaving(false);
    }
  };

  const updateCurrentStrategy = async () => {
    if (!selectedStrategy) return;
    setEditorError("");
    let rule: Record<string, unknown>;
    try {
      rule = parseRule();
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : String(error));
      return;
    }

    setIsSaving(true);
    try {
      await updateStrategyDefinition(selectedStrategy.id, {
        name,
        description,
        targetUniverse: parseCsv(targetUniverse),
        periods: parseNumberCsv(periods),
        sources: parseCsv(sources) as DataSourceValue[],
        rule,
      });
      await refreshStrategies();
      setVersions(await listStrategyVersions(selectedStrategy.id));
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSaving(false);
    }
  };

  const setLifecycle = async (action: "enable" | "disable") => {
    if (!selectedStrategy) return;
    setIsActionRunning(true);
    try {
      if (action === "enable") {
        await enableStrategyDefinition(selectedStrategy.id);
      } else {
        await disableStrategyDefinition(selectedStrategy.id);
      }
      await refreshStrategies();
    } finally {
      setIsActionRunning(false);
    }
  };

  const acknowledgeAlert = async (id: number) => {
    setIsActionRunning(true);
    try {
      const updated = await acknowledgeStrategyAlertEvent(id);
      setAlerts((items) => items.map((item) => (item.id === id ? updated : item)));
    } finally {
      setIsActionRunning(false);
    }
  };

  const runScan = async () => {
    setIsActionRunning(true);
    try {
      const result = await runStrategyScan({
        strategyDefinitionId: selectedStrategy?.id,
        period: selectedStrategy?.periods[0],
        source: selectedStrategy?.sources[0],
      });
      setScanResult(
        `新增信号 ${result.createdSignalCount ?? 0} / 新增告警 ${
          result.createdAlertCount ?? 0
        } / 跳过重复 ${result.skippedDuplicateCount ?? 0}`
      );
      setSignals(await fetchStrategySignals());
      setAlerts(await fetchStrategyAlertEvents());
    } finally {
      setIsActionRunning(false);
    }
  };

  const runBacktest = async () => {
    setIsActionRunning(true);
    try {
      const run = await createStrategyBacktest({
        strategyVersionId: Number(backtestVersionId),
        targetUniverse: parseCsv(backtestUniverse),
        period: Number(backtestPeriod),
        source: backtestSource,
        startDate: backtestStartDate,
        endDate: backtestEndDate,
      });
      setBacktestRun(run);
      setBacktestSignals(await fetchStrategyBacktestSignals(run.id));
    } finally {
      setIsActionRunning(false);
    }
  };

  return (
    <main className="strategy-page">
      <header className="strategy-header">
        <div>
          <h1>策略工作台</h1>
          <p>管理策略定义、信号、告警和 signal-level 回测。</p>
        </div>
        <div className="strategy-header-actions">
          <button disabled={isActionRunning} onClick={runScan} type="button">
            运行扫描
          </button>
          {scanResult ? <span>{scanResult}</span> : null}
        </div>
        <nav className="strategy-nav" aria-label="主导航">
          <a href="/k">K 线</a>
          <a href="/strategies" aria-current="page">
            策略
          </a>
        </nav>
      </header>

      {loadError ? <p className="strategy-error">{loadError}</p> : null}
      {isLoading ? <p className="strategy-muted">正在加载策略平台数据...</p> : null}

      <section className="strategy-shell">
        <aside className="strategy-sidebar">
          <div className="strategy-section-title">
            <h2>策略库</h2>
            <span>{strategies.length} 个策略</span>
          </div>
          <div className="strategy-list">
            {strategies.map((item) => (
              <button
                className={item.id === selectedId ? "selected" : ""}
                key={item.id}
                onClick={() => setSelectedId(item.id)}
                type="button"
              >
                <strong>{item.name}</strong>
                <span>{item.status}</span>
                <small>当前版本 #{item.currentVersionId ?? "-"}</small>
              </button>
            ))}
          </div>
        </aside>

        <section className="strategy-main-panel">
          <div className="strategy-tabs" role="tablist" aria-label="策略工作区">
            {[
              ["registry", "策略详情"],
              ["signals", "信号历史"],
              ["alerts", "告警事件"],
              ["backtests", "信号回测"],
            ].map(([id, label]) => (
              <button
                aria-selected={activeTab === id}
                key={id}
                onClick={() => setActiveTab(id as StrategyTab)}
                role="tab"
                type="button"
              >
                {label}
              </button>
            ))}
          </div>

          {activeTab === "registry" ? (
            <section className="strategy-panel" aria-label="策略详情">
              {selectedStrategy ? (
                <div className="strategy-detail-grid">
                  <div>
                    <h2>{selectedStrategy.name}</h2>
                    <p>{selectedStrategy.description}</p>
                  </div>
                  <dl>
                    <div>
                      <dt>状态</dt>
                      <dd>{statusLabel(selectedStrategy.status)}</dd>
                    </div>
                    <div>
                      <dt>当前版本</dt>
                      <dd>当前版本 #{selectedStrategy.currentVersionId ?? "-"}</dd>
                    </div>
                    <div>
                      <dt>目标证券</dt>
                      <dd>{selectedStrategy.targetUniverse.join(", ")}</dd>
                    </div>
                    <div>
                      <dt>周期/来源</dt>
                      <dd>
                        {selectedStrategy.periods.join(", ")} /{" "}
                        {selectedStrategy.sources.join(", ")}
                      </dd>
                    </div>
                  </dl>
                  <div className="strategy-actions">
                    <button
                      disabled={isActionRunning}
                      onClick={() => setLifecycle("disable")}
                      type="button"
                    >
                      停用
                    </button>
                    <button
                      disabled={isActionRunning}
                      onClick={() => setLifecycle("enable")}
                      type="button"
                    >
                      启用
                    </button>
                    <button
                      disabled={isActionRunning}
                      onClick={runScan}
                      type="button"
                    >
                      扫描当前策略
                    </button>
                  </div>
                </div>
              ) : (
                <p className="strategy-muted">暂无策略定义</p>
              )}

              <div className="strategy-editor">
                <h2>策略编辑</h2>
                <label>
                  策略名称
                  <input value={name} onChange={(event) => setName(event.target.value)} />
                </label>
                <label>
                  描述
                  <input
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                  />
                </label>
                <label>
                  目标证券
                  <input
                    value={targetUniverse}
                    onChange={(event) => setTargetUniverse(event.target.value)}
                  />
                </label>
                <div className="strategy-editor-row">
                  <label>
                    周期
                    <input value={periods} onChange={(event) => setPeriods(event.target.value)} />
                  </label>
                  <label>
                    来源
                    <input value={sources} onChange={(event) => setSources(event.target.value)} />
                  </label>
                </div>
                <label>
                  规则 JSON
                  <textarea
                    rows={8}
                    value={ruleText}
                    onChange={(event) => setRuleText(event.target.value)}
                  />
                </label>
                {editorError ? <p className="strategy-error">{editorError}</p> : null}
                <div className="strategy-actions">
                  <button disabled={isSaving} onClick={saveStrategy} type="button">
                    保存策略
                  </button>
                  <button
                    disabled={isSaving || !selectedStrategy}
                    onClick={updateCurrentStrategy}
                    type="button"
                  >
                    更新当前策略
                  </button>
                </div>
              </div>

              <section className="strategy-table-wrap">
                <h2>版本</h2>
                <table>
                  <thead>
                    <tr>
                      <th>版本</th>
                      <th>Schema</th>
                      <th>创建时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {versions.map((item) => (
                      <tr key={item.id}>
                        <td>版本 {item.versionNumber}</td>
                        <td>{item.ruleSchemaVersion}</td>
                        <td>{formatDateTime(item.createTime)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </section>
          ) : null}

          {activeTab === "signals" ? (
            <section className="strategy-panel" aria-label="信号历史">
              <h2>信号历史</h2>
              <table>
                <thead>
                  <tr>
                    <th>策略</th>
                    <th>版本</th>
                    <th>证券</th>
                    <th>周期</th>
                    <th>来源</th>
                    <th>时间</th>
                  </tr>
                </thead>
                <tbody>
                  {signals.map((item) => (
                    <tr key={item.id}>
                      <td>{item.strategyDefinitionId}</td>
                      <td>{item.strategyVersionId}</td>
                      <td>{item.securityCode}</td>
                      <td>{item.period}</td>
                      <td>{item.source}</td>
                      <td>{formatDateTime(item.signalTime)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ) : null}

          {activeTab === "alerts" ? (
            <section className="strategy-panel" aria-label="告警事件">
              <h2>告警事件</h2>
              <table>
                <thead>
                  <tr>
                    <th>事件</th>
                    <th>信号</th>
                    <th>状态</th>
                    <th>去重键</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.map((item) => (
                    <tr key={item.id}>
                      <td>{item.id}</td>
                      <td>{item.strategySignalId}</td>
                      <td>{item.status}</td>
                      <td>{item.dedupeKey}</td>
                      <td>
                        <button
                          disabled={isActionRunning || item.status === "acked"}
                          onClick={() => acknowledgeAlert(item.id)}
                          type="button"
                        >
                          确认告警
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ) : null}

          {activeTab === "backtests" ? (
            <section className="strategy-panel" aria-label="信号回测">
              <h2>信号回测</h2>
              <div className="strategy-editor-row">
                <label>
                  回测版本 ID
                  <input
                    value={backtestVersionId}
                    onChange={(event) => setBacktestVersionId(event.target.value)}
                  />
                </label>
                <label>
                  回测证券
                  <input
                    value={backtestUniverse}
                    onChange={(event) => setBacktestUniverse(event.target.value)}
                  />
                </label>
              </div>
              <div className="strategy-editor-row">
                <label>
                  周期
                  <input
                    value={backtestPeriod}
                    onChange={(event) => setBacktestPeriod(event.target.value)}
                  />
                </label>
                <label>
                  来源
                  <select
                    value={backtestSource}
                    onChange={(event) => setBacktestSource(event.target.value as DataSourceValue)}
                  >
                    <option value="tdx">tdx</option>
                    <option value="ef">ef</option>
                    <option value="mqmt">mqmt</option>
                  </select>
                </label>
                <label>
                  开始日期
                  <input
                    type="date"
                    value={backtestStartDate}
                    onChange={(event) => setBacktestStartDate(event.target.value)}
                  />
                </label>
                <label>
                  结束日期
                  <input
                    type="date"
                    value={backtestEndDate}
                    onChange={(event) => setBacktestEndDate(event.target.value)}
                  />
                </label>
              </div>
              <button disabled={isActionRunning} onClick={runBacktest} type="button">
                运行回测
              </button>

              {backtestRun ? (
                <div className="strategy-metrics">
                  <strong>{statusLabel(backtestRun.status as BacktestRunStatus)}</strong>
                  <span>命中信号 {backtestRun.signalCount}</span>
                  <span>命中证券 {backtestRun.matchedSecurityCount}</span>
                  <span>开始 {formatDateTime(backtestRun.startedAt)}</span>
                  <span>完成 {formatDateTime(backtestRun.completedAt)}</span>
                </div>
              ) : null}

              <table>
                <thead>
                  <tr>
                    <th>证券</th>
                    <th>周期</th>
                    <th>来源</th>
                    <th>信号时间</th>
                    <th>规则</th>
                    <th>上下文</th>
                  </tr>
                </thead>
                <tbody>
                  {backtestSignals.map((item) => (
                    <tr key={item.id}>
                      <td>{item.securityCode}</td>
                      <td>{item.period}</td>
                      <td>{item.source}</td>
                      <td>{formatDateTime(item.signalTime)}</td>
                      <td>{formatJson(item.ruleSnapshot)}</td>
                      <td>{formatJson(item.contextSnapshot)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ) : null}
        </section>
      </section>
    </main>
  );
}
