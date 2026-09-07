"use client";

import type { StrategySignal, StrategyBacktestSignalResult } from "@/app/api/client";
import { formatShanghaiDateTime } from "@/app/lib/time";

export type TraceSignalInput = StrategySignal | StrategyBacktestSignalResult;

export interface DecisionTraceDrawerProps {
  signal: TraceSignalInput | null;
  onClose: () => void;
  onOpenLiveKLine?: (securityCode: string, timestamp: string) => void;
}

const CONFIDENCE_BADGES: Record<string, { bg: string; text: string; border: string }> = {
  HIGH: {
    bg: "rgba(74, 222, 128, 0.12)",
    text: "var(--sem-success)",
    border: "var(--sem-success)",
  },
  MEDIUM: {
    bg: "rgba(251, 191, 36, 0.12)",
    text: "var(--sem-warn)",
    border: "var(--sem-warn)",
  },
  LOW: {
    bg: "rgba(248, 113, 113, 0.12)",
    text: "var(--sem-danger)",
    border: "var(--sem-danger)",
  },
};

export function DecisionTraceDrawer({
  signal,
  onClose,
  onOpenLiveKLine,
}: DecisionTraceDrawerProps) {
  if (!signal) return null;

  const securityCode =
    "securityCode" in signal
      ? signal.securityCode
      : (signal as StrategySignal).security?.code ?? String(signal.securityId);

  const securityName =
    "security" in signal && (signal as StrategySignal).security?.name
      ? (signal as StrategySignal).security?.name
      : "";

  const signalTimeStr = formatShanghaiDateTime(signal.signalTime);

  // 提取置信度与轨迹快照
  const confidence = signal.confidence ?? 85.0;
  const confidenceLevel =
    signal.confidenceLevel ?? (confidence >= 80 ? "HIGH" : confidence >= 65 ? "MEDIUM" : "LOW");
  const confStyle = CONFIDENCE_BADGES[confidenceLevel] ?? CONFIDENCE_BADGES.HIGH;

  const traceObj = (signal.decisionTrace || {}) as Record<string, unknown>;
  const ctx = (signal.contextSnapshot || {}) as Record<string, unknown>;
  const traceItems = (traceObj.trace || ctx.trace || []) as Array<Record<string, unknown>>;
  const summary = (traceObj.summary as string) || (ctx.summary as string) || "综合多因子决策流计算触发";

  // 提取缠论特征（向下兼容旧数据与当前插件）
  const chanBsp = (ctx.chanBsp || (ctx.event as Record<string, unknown>) || {}) as Record<string, unknown>;
  const hasChanEvidence = Boolean(chanBsp.zg || chanBsp.zd || ctx.zg || ctx.zd);
  const zg = chanBsp.zg ?? ctx.zg;
  const zd = chanBsp.zd ?? ctx.zd;

  return (
    <div
      className="decision-trace-drawer-backdrop"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.65)",
        zIndex: 1000,
        display: "flex",
        justifyContent: "flex-end",
      }}
    >
      <div
        className="decision-trace-drawer"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="白盒决策归因与轨迹诊断"
        style={{
          width: "100%",
          maxWidth: 580,
          height: "100%",
          backgroundColor: "var(--surface-overlay)",
          color: "var(--text-primary)",
          display: "flex",
          flexDirection: "column",
          boxShadow: "var(--shadow-overlay)",
          overflowY: "auto",
        }}
      >
        {/* Header */}
        <header
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0, color: "var(--text-primary)" }}>
                {securityCode} {securityName}
              </h2>
              <span
                className="tnum"
                style={{
                  padding: "2px 8px",
                  borderRadius: 4,
                  fontSize: 12,
                  fontWeight: 600,
                  backgroundColor: confStyle.bg,
                  color: confStyle.text,
                  border: `1px solid ${confStyle.border}`,
                }}
              >
                {confidenceLevel} {Number(confidence).toFixed(1)}%
              </span>
            </div>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>触发时刻: {signalTimeStr}</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {onOpenLiveKLine ? (
              <button
                type="button"
                onClick={() => onOpenLiveKLine(securityCode, signal.signalTime)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 6,
                  border: "1px solid var(--brand)",
                  background: "rgba(43, 169, 192, 0.12)",
                  color: "var(--brand)",
                  fontSize: 12,
                  cursor: "pointer",
                  fontWeight: 500,
                }}
              >
                在看盘中打开 ↗
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--text-secondary)",
                fontSize: 18,
                cursor: "pointer",
                padding: "4px 8px",
              }}
            >
              ✕
            </button>
          </div>
        </header>

        {/* Body Content */}
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Card: 决策一句话摘要 */}
          <section
            style={{
              padding: 14,
              borderRadius: 8,
              background: "var(--surface-raised)",
              border: "1px solid var(--border-subtle)",
              boxShadow: "var(--shadow-card)",
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
                marginBottom: 6,
                fontWeight: 600,
                textTransform: "uppercase",
              }}
            >
              白盒决策归因摘要
            </div>
            <p style={{ fontSize: 13, margin: 0, lineHeight: 1.6, color: "var(--text-primary)" }}>
              {summary}
            </p>
          </section>

          {/* Card: 决策流节点轨迹 */}
          {traceItems.length > 0 ? (
            <section
              style={{
                padding: 16,
                borderRadius: 8,
                background: "var(--surface-raised)",
                border: "1px solid var(--border-subtle)",
                boxShadow: "var(--shadow-card)",
              }}
            >
              <h3 style={{ fontSize: 14, margin: "0 0 12px 0", fontWeight: 600, color: "var(--text-primary)" }}>
                决策树推导链路 (Execution Trace)
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {traceItems.map((item, idx) => {
                  const nodeType = String(item.type || "");
                  const isPass = item.action !== "ABORT";
                  return (
                    <div
                      key={idx}
                      style={{
                        padding: 12,
                        borderRadius: 6,
                        border: "1px solid var(--border-subtle)",
                        background: "var(--surface-base)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span
                            style={{
                              padding: "2px 6px",
                              borderRadius: 4,
                              fontSize: 10,
                              fontWeight: 600,
                              background:
                                nodeType === "GUARD"
                                  ? "var(--sem-excess)"
                                  : nodeType === "CONSENSUS"
                                    ? "var(--sem-benchmark)"
                                    : "var(--brand)",
                              color: "#ffffff",
                            }}
                          >
                            {nodeType}
                          </span>
                          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                            {String(item.name || item.nodeId)}
                          </span>
                        </div>
                        <span
                          style={{
                            fontSize: 12,
                            color: isPass ? "var(--sem-success)" : "var(--sem-danger)",
                            fontWeight: 600,
                          }}
                        >
                          {isPass ? "✓ 通过" : "✕ 阻断"}
                        </span>
                      </div>

                      {item.reason ? (
                        <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "4px 0 0 0" }}>
                          {String(item.reason)}
                        </p>
                      ) : null}

                      {/* 若为共识节点，渲染插件投票分解表 */}
                      {Array.isArray(item.breakdown) && item.breakdown.length > 0 ? (
                        <div style={{ marginTop: 8, borderTop: "1px solid var(--border-subtle)", paddingTop: 8 }}>
                          <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>
                            加权因子投票明细:
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            {item.breakdown.map((b: Record<string, unknown>, bIdx: number) => {
                              const weight = typeof b.weight === "number" || typeof b.weight === "string" ? b.weight : 0;
                              const conf = typeof b.confidence === "number" ? b.confidence : 0;
                              const actionStr = String(b.action || "");
                              return (
                                <div
                                  key={bIdx}
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    fontSize: 11,
                                    color: "var(--text-secondary)",
                                    background: "var(--surface-raised)",
                                    border: "1px solid var(--border-subtle)",
                                    padding: "4px 8px",
                                    borderRadius: 4,
                                  }}
                                >
                                  <span>{String(b.pluginId || "").replace("plugin.", "")} (权重 {String(weight)}%)</span>
                                  <span className="tnum">
                                    {actionStr === "BUY" ? "看多" : actionStr === "SELL" ? "看空" : "弃权"} (确信度: {(conf * 100).toFixed(0)}%)
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          {/* Card: 缠论几何形态证据（若包含缠论中枢） - 严格遵循 A股红涨绿跌 Token */}
          {hasChanEvidence ? (
            <section
              style={{
                padding: 16,
                borderRadius: 8,
                background: "var(--surface-raised)",
                border: "1px solid var(--border-subtle)",
                boxShadow: "var(--shadow-card)",
              }}
            >
              <h3 style={{ fontSize: 14, margin: "0 0 12px 0", fontWeight: 600, color: "var(--text-primary)" }}>
                缠论几何中枢区间 (Chan Central Geometry)
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ padding: 10, background: "var(--surface-base)", borderRadius: 6, border: "1px solid var(--border-subtle)" }}>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>中枢高点 (ZG)</span>
                  <div className="tnum" style={{ fontSize: 16, fontWeight: 600, color: "var(--sem-up)", marginTop: 2 }}>
                    {zg !== null && zg !== undefined ? Number(zg).toFixed(2) : "-"}
                  </div>
                </div>
                <div style={{ padding: 10, background: "var(--surface-base)", borderRadius: 6, border: "1px solid var(--border-subtle)" }}>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>中枢低点 (ZD)</span>
                  <div className="tnum" style={{ fontSize: 16, fontWeight: 600, color: "var(--sem-down)", marginTop: 2 }}>
                    {zd !== null && zd !== undefined ? Number(zd).toFixed(2) : "-"}
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          {/* Card: 原始上下文快照 */}
          <details
            style={{
              padding: 12,
              borderRadius: 6,
              background: "var(--surface-raised)",
              border: "1px solid var(--border-subtle)",
              cursor: "pointer",
            }}
          >
            <summary style={{ fontSize: 12, color: "var(--text-muted)" }}>查看原始 Context Snapshot (JSON)</summary>
            <pre
              className="tnum"
              style={{
                margin: "8px 0 0 0",
                fontSize: 11,
                color: "var(--text-secondary)",
                overflowX: "auto",
                maxHeight: 200,
                background: "var(--surface-base)",
                padding: 8,
                borderRadius: 4,
              }}
            >
              {JSON.stringify(ctx, null, 2)}
            </pre>
          </details>
        </div>
      </div>
    </div>
  );
}
