"use client";

import { useEffect, useMemo, useState } from "react";
import {
  acknowledgeStrategyAlertEvent,
  createStrategyDefinition,
  disableStrategyDefinition,
  enableStrategyDefinition,
  fetchFactorPlugins,
  fetchStrategyAlertEvents,
  fetchStrategySignals,
  listStrategies,
  listStrategyVersions,
  type DataSourceValue,
  type FactorPluginVo,
  type StrategyAlertEvent,
  type StrategyDefinition,
  type StrategySignal,
  type StrategySignalKind,
  type StrategyVersion,
} from "@/app/api/client";

import { formatShanghaiDateTime } from "@/app/lib/time";
import { WorkspaceShell } from "@/app/components/layout/WorkspaceShell";
import { PluginCatalog } from "./components/PluginCatalog";
import { DecisionFlowBuilder } from "./components/DecisionFlowBuilder";
import { DecisionTraceDrawer } from "@/app/components/DecisionTraceDrawer";

type StrategyTab = "registry" | "catalog" | "signals" | "alerts";

const STRATEGY_SIGNAL_KINDS: readonly StrategySignalKind[] = ["entry", "exit"];

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
  return formatShanghaiDateTime(value);
};

const statusLabel = (status?: string) => status || "-";

export default function StrategiesWorkspace() {
  const [activeTab, setActiveTab] = useState<StrategyTab>("registry");
  const [strategies, setStrategies] = useState<StrategyDefinition[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [versions, setVersions] = useState<StrategyVersion[]>([]);
  const [signals, setSignals] = useState<StrategySignal[]>([]);
  const [alerts, setAlerts] = useState<StrategyAlertEvent[]>([]);
  const [plugins, setPlugins] = useState<FactorPluginVo[]>([]);
  const [selectedSignal, setSelectedSignal] = useState<StrategySignal | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isActionRunning, setIsActionRunning] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [editorError, setEditorError] = useState("");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [targetUniverse, setTargetUniverse] = useState("600519, 000001");
  const [periods, setPeriods] = useState("1440");
  const [sources, setSources] = useState("tdx");
  const [signalKind, setSignalKind] = useState<StrategySignalKind>("entry");
  const [flowRule, setFlowRule] = useState<Record<string, unknown>>({});

  const selectedStrategy = useMemo(
    () => strategies.find((item) => item.id === selectedId) || null,
    [selectedId, strategies]
  );

  const currentVersion = useMemo(
    () =>
      versions.find(
        (item) => item.id === selectedStrategy?.currentVersionId
      ) ||
      versions[0] ||
      null,
    [selectedStrategy, versions]
  );

  const refreshStrategies = async () => {
    try {
      const items = await listStrategies();
      setStrategies(items);
      if (items.length > 0 && selectedId === null) {
        setSelectedId(items[0].id);
      }
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : String(error));
    }
  };

  useEffect(() => {
    let mounted = true;
    const loadAll = async () => {
      setIsLoading(true);
      setLoadError("");
      try {
        const [loadedStrategies, loadedPlugins] = await Promise.all([
          listStrategies(),
          fetchFactorPlugins().catch(() => []),
        ]);
        if (!mounted) return;
        setStrategies(loadedStrategies);
        setPlugins(loadedPlugins);
        if (loadedStrategies.length > 0) {
          setSelectedId(loadedStrategies[0].id);
        }
      } catch (error) {
        if (!mounted) return;
        setLoadError(error instanceof Error ? error.message : String(error));
      } finally {
        if (mounted) setIsLoading(false);
      }
    };
    loadAll();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setVersions([]);
      return;
    }
    let mounted = true;
    listStrategyVersions(selectedId)
      .then((items) => {
        if (mounted) setVersions(items);
      })
      .catch((error) => {
        if (mounted) {
          setLoadError(error instanceof Error ? error.message : String(error));
        }
      });
    return () => {
      mounted = false;
    };
  }, [selectedId]);

  useEffect(() => {
    let mounted = true;
    const loadTabDetails = async () => {
      try {
        if (activeTab === "signals") {
          const items = await fetchStrategySignals(
            selectedId ? { strategyDefinitionId: selectedId } : undefined
          );
          if (mounted) setSignals(items);
        } else if (activeTab === "alerts") {
          const items = await fetchStrategyAlertEvents();
          if (mounted) setAlerts(items);
        }
      } catch (error) {
        if (mounted) {
          setLoadError(error instanceof Error ? error.message : String(error));
        }
      }
    };
    loadTabDetails();
    return () => {
      mounted = false;
    };
  }, [activeTab, selectedId]);

  const saveStrategy = async () => {
    setEditorError("");
    setIsSaving(true);
    try {
      await createStrategyDefinition({
        name,
        description,
        targetUniverse: parseCsv(targetUniverse),
        periods: parseNumberCsv(periods),
        sources: parseCsv(sources) as DataSourceValue[],
        rule: flowRule,
        signalKind,
      });
      await refreshStrategies();
      setName("");
      setDescription("");
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

  const openLiveKLine = (code: string, timestamp: string) => {
    window.open(`/k?code=${code}&focusTime=${encodeURIComponent(timestamp)}`, "_blank");
  };

  return (
    <div className="strategy-page" style={{ padding: 0, minHeight: "calc(100vh - 52px)" }}>
      <WorkspaceShell
        storageKey="mist_workspace_sidebar_strategies"
        sidebarTitle={<h1 className="workspace-sidebar-title">策略工作台</h1>}
        sidebarWidth={320}
        sidebar={
          <div className="strategy-sidebar" style={{ width: "100%", padding: 0, border: "none" }}>
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
          </div>
        }
      >
        {loadError ? <p className="strategy-error">{loadError}</p> : null}
        {isLoading ? <p className="strategy-muted">正在加载策略平台数据...</p> : null}

        <section className="strategy-main-panel">
          <div className="strategy-tabs" role="tablist" aria-label="策略工作区">
            {[
              ["registry", "策略详情"],
              ["catalog", "因子插件货架"],
              ["signals", "实时信号历史"],
              ["alerts", "告警事件"],
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
                      <dt>信号类型</dt>
                      <dd>{currentVersion?.signalKind ?? "-"}</dd>
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
                  <p className="strategy-muted">
                    策略定义为创建后只读；如需修改名称、标的、决策树或信号类型，请在下方创建新的策略定义。
                  </p>
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
                  </div>
                </div>
              ) : (
                <p className="strategy-muted">请选择或创建一个策略定义。</p>
              )}

              <hr className="strategy-divider" />

              {/* 创建策略表单 */}
              <div className="strategy-create-panel">
                <div className="strategy-section-title">
                  <h2>创建新策略定义</h2>
                  <span>基于通用因子插件与决策流树编排</span>
                </div>
                {editorError ? <p className="strategy-error">{editorError}</p> : null}
                <div className="strategy-form-grid">
                  <label className="field">
                    策略名称
                    <input
                      onChange={(e) => setName(e.target.value)}
                      placeholder="如：双因子共识动量突破策略"
                      value={name}
                    />
                  </label>
                  <label className="field">
                    策略描述
                    <input
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="简述策略选股与出入场逻辑"
                      value={description}
                    />
                  </label>
                  <label className="field">
                    目标证券
                    <input
                      onChange={(e) => setTargetUniverse(e.target.value)}
                      placeholder="逗号分隔，如 600519, 000001"
                      value={targetUniverse}
                    />
                  </label>
                  <label className="field">
                    执行周期
                    <input
                      onChange={(e) => setPeriods(e.target.value)}
                      placeholder="分钟数，如 1, 5, 15, 30, 60, 1440"
                      value={periods}
                    />
                  </label>
                  <label className="field">
                    行情数据源
                    <input
                      onChange={(e) => setSources(e.target.value)}
                      placeholder="逗号分隔，如 tdx, qmt"
                      value={sources}
                    />
                  </label>
                  <label className="field">
                    信号类型
                    <select
                      onChange={(e) =>
                        setSignalKind(e.target.value as StrategySignalKind)
                      }
                      value={signalKind}
                    >
                      {STRATEGY_SIGNAL_KINDS.map((kind) => (
                        <option key={kind} value={kind}>
                          {kind === "entry" ? "买入/入场 (entry)" : "卖出/出场 (exit)"}
                        </option>
                      ))}
                    </select>
                  </label>

                  {/* 决策流可视化编排器 */}
                  <div style={{ gridColumn: "1 / -1", marginTop: 8 }}>
                    <DecisionFlowBuilder plugins={plugins} onChange={setFlowRule} />
                  </div>

                  <div className="form-footer" style={{ gridColumn: "1 / -1", marginTop: 12 }}>
                    <button
                      disabled={isSaving || !name.trim()}
                      onClick={saveStrategy}
                      type="button"
                    >
                      {isSaving ? "正在创建..." : "创建策略"}
                    </button>
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          {/* Tab 2: 因子货架 */}
          {activeTab === "catalog" ? (
            <section className="strategy-panel" aria-label="因子货架">
              <PluginCatalog plugins={plugins} />
            </section>
          ) : null}

          {/* Tab 3: 实时信号历史 */}
          {activeTab === "signals" ? (
            <section className="strategy-panel" aria-label="信号历史">
              <div className="strategy-section-title">
                <h2>实时信号历史</h2>
                <span>已触发 {signals.length} 条信号 · 点击查看白盒归因轨迹</span>
              </div>
              {signals.length === 0 ? (
                <p className="strategy-muted">暂无信号记录。</p>
              ) : (
                <div className="table-responsive-container">
                  <table>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>标的代码</th>
                        <th>标的名称</th>
                        <th>信号类型</th>
                        <th>置信度</th>
                        <th>周期/来源</th>
                        <th>信号时间</th>
                        <th>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {signals.map((item, idx) => {
                        const code = item.security?.code ?? String(item.securityId);
                        const secName = item.security?.name ?? "-";
                        const conf = item.confidence ?? 85.0;
                        const confLevel = item.confidenceLevel ?? (conf >= 80 ? "HIGH" : conf >= 65 ? "MEDIUM" : "LOW");
                        return (
                          <tr
                            key={item.id}
                            onClick={() => setSelectedSignal(item)}
                            style={{ cursor: "pointer" }}
                          >
                            <td className="tnum">{idx + 1}</td>
                            <td>
                              <strong>{code}</strong>
                            </td>
                            <td>{secName}</td>
                            <td>
                              <span className={`bsp-tag ${item.signalKind === "entry" ? "bsp-buy" : "bsp-sell"}`}>
                                {item.signalKind === "entry" ? "买入 (BUY)" : "卖出 (SELL)"}
                              </span>
                            </td>
                            <td>
                              <span
                                className="tnum"
                                style={{
                                  padding: "2px 6px",
                                  borderRadius: 4,
                                  fontSize: 11,
                                  fontWeight: 600,
                                  background:
                                    confLevel === "HIGH"
                                      ? "rgba(74, 222, 128, 0.12)"
                                      : confLevel === "MEDIUM"
                                        ? "rgba(251, 191, 36, 0.12)"
                                        : "rgba(248, 113, 113, 0.12)",
                                  color:
                                    confLevel === "HIGH"
                                      ? "var(--sem-success)"
                                      : confLevel === "MEDIUM"
                                        ? "var(--sem-warn)"
                                        : "var(--sem-danger)",
                                }}
                              >
                                {confLevel} {Number(conf).toFixed(1)}%
                              </span>
                            </td>
                            <td className="tnum">
                              {item.period}m / {item.source}
                            </td>
                            <td className="tnum">{formatDateTime(item.signalTime)}</td>
                            <td>
                              <div style={{ display: "flex", gap: 8 }}>
                                <button
                                  type="button"
                                  className="action-link-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedSignal(item);
                                  }}
                                >
                                  白盒归因
                                </button>
                                <button
                                  type="button"
                                  className="action-link-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openLiveKLine(code, item.signalTime);
                                  }}
                                  style={{ color: "var(--brand)" }}
                                >
                                  看盘 ↗
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ) : null}

          {/* Tab 4: 告警事件 */}
          {activeTab === "alerts" ? (
            <section className="strategy-panel" aria-label="告警事件">
              <div className="strategy-section-title">
                <h2>告警投递事件</h2>
                <span>共 {alerts.length} 条告警事件</span>
              </div>
              {alerts.length === 0 ? (
                <p className="strategy-muted">暂无告警事件。</p>
              ) : (
                <div className="table-responsive-container">
                  <table>
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>状态</th>
                        <th>去重键</th>
                        <th>触发时间</th>
                        <th>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {alerts.map((item) => (
                        <tr key={item.id}>
                          <td className="tnum">#{item.id}</td>
                          <td>
                            <span className={`status-pill ${item.status}`}>{item.status}</span>
                          </td>
                          <td>
                            <code>{item.dedupeKey}</code>
                          </td>
                          <td className="tnum">{formatDateTime(item.createdAt)}</td>
                          <td>
                            {item.status === "pending" ? (
                              <button
                                disabled={isActionRunning}
                                onClick={() => acknowledgeAlert(item.id)}
                                type="button"
                                className="action-link-btn"
                              >
                                确认告警
                              </button>
                            ) : (
                              <span className="strategy-muted">已确认</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ) : null}
        </section>
      </WorkspaceShell>

      {/* 白盒决策归因通用抽屉 */}
      <DecisionTraceDrawer
        signal={selectedSignal}
        onClose={() => setSelectedSignal(null)}
        onOpenLiveKLine={openLiveKLine}
      />
    </div>
  );
}
