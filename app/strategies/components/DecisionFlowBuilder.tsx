"use client";

import { useState, useEffect } from "react";
import type { FactorPluginVo } from "@/app/api/client";

export interface DecisionFlowBuilderProps {
  plugins: FactorPluginVo[];
  onChange: (flowRule: Record<string, unknown>) => void;
}

export function DecisionFlowBuilder({ plugins, onChange }: DecisionFlowBuilderProps) {
  const [selectedPreset, setSelectedPreset] = useState<string>("breakout_guard");

  // 门禁配置
  const [enableGuard, setEnableGuard] = useState<boolean>(true);
  const [guardPluginId, setGuardPluginId] = useState<string>("plugin.fundamental.safety-guard");
  const [guardMinConf, setGuardMinConf] = useState<number>(0.8);

  // 共识打分配置
  const [consensusThreshold, setConsensusThreshold] = useState<number>(75.0);
  const [techWeight, setTechWeight] = useState<number>(60);
  const [capitalWeight, setCapitalWeight] = useState<number>(40);
  const [enableVeto, setEnableVeto] = useState<boolean>(true);

  // 缠论参数
  const [chanUnits, setChanUnits] = useState<string>("bi");
  const [chanDirection, setChanDirection] = useState<string>("buy");

  // 生成决策树 AST
  useEffect(() => {
    let rootNode: Record<string, unknown>;

    if (selectedPreset === "chan_bsp") {
      rootNode = {
        id: "guard_chan_bsp",
        type: "GUARD",
        name: "缠论买卖点结构确认",
        pluginId: "plugin.chan.bsp",
        params: {
          units: chanUnits,
          direction: chanDirection,
          points: { first: true, second: true, third: true },
          deduplicate: true,
        },
        requiredAction: chanDirection === "sell" ? "SELL" : "BUY",
        minConfidence: 0.8,
        onPass: {
          id: "term_chan_pass",
          type: "TERMINAL",
          action: chanDirection === "sell" ? "SELL" : "BUY",
          signalTag: "CHAN_BSP_CONFIRMED",
          reason: `缠论${chanUnits === "duan" ? "线段" : "笔"}级买卖点确立`,
        },
        onFail: {
          id: "term_chan_fail",
          type: "TERMINAL",
          action: "ABORT",
          reason: "缠论形态未确认",
        },
      };
    } else {
      // 默认/复合决策树：门禁 -> 加权共识 -> 终结节点
      const consensusNode: Record<string, unknown> = {
        id: "consensus_factors",
        type: "CONSENSUS",
        name: "多因子加权共识打分",
        threshold: consensusThreshold,
        plugins: [
          {
            pluginId: "plugin.technical.volume-breakout",
            weight: techWeight,
            params: { lookback: 20, volumeMultiple: 1.8 },
          },
          {
            pluginId: "plugin.capital.northbound",
            weight: capitalWeight,
            isVeto: enableVeto,
            params: { minInflowWan: 1000 },
          },
        ],
        onSuccess: {
          id: "term_signal_buy",
          type: "TERMINAL",
          action: "BUY",
          signalTag: "RESONANCE_BREAKOUT",
          reason: "财务安全通过，放量突破与外资加仓综合达标",
        },
        onFailure: {
          id: "term_signal_abort",
          type: "TERMINAL",
          action: "ABORT",
          reason: "综合加权得分未达门槛",
        },
      };

      if (enableGuard) {
        rootNode = {
          id: "guard_safety",
          type: "GUARD",
          name: "财务与基本面安全防线",
          pluginId: guardPluginId,
          params: { minRoe: 8.0, maxDebtRatio: 70.0 },
          requiredAction: "BUY",
          minConfidence: guardMinConf,
          onPass: consensusNode,
          onFail: {
            id: "term_guard_fail",
            type: "TERMINAL",
            action: "ABORT",
            reason: "前置基本面门禁未通过，直接短路熔断",
          },
        };
      } else {
        rootNode = consensusNode;
      }
    }

    onChange({
      kind: "decision_flow",
      requiredBarCount: 50,
      rootNode,
    });
  }, [
    selectedPreset,
    enableGuard,
    guardPluginId,
    guardMinConf,
    consensusThreshold,
    techWeight,
    capitalWeight,
    enableVeto,
    chanUnits,
    chanDirection,
    onChange,
  ]);

  return (
    <div
      className="decision-flow-builder"
      style={{
        padding: 16,
        borderRadius: 8,
        border: "1px solid var(--border-subtle)",
        background: "var(--surface-raised)",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
          决策流树状架构编排器 (Factor Tree Studio)
        </h4>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={() => setSelectedPreset("breakout_guard")}
            style={{
              padding: "4px 10px",
              borderRadius: 6,
              fontSize: 12,
              cursor: "pointer",
              border: selectedPreset === "breakout_guard" ? "1px solid var(--brand)" : "1px solid var(--border-subtle)",
              background: selectedPreset === "breakout_guard" ? "rgba(43, 169, 192, 0.15)" : "transparent",
              color: selectedPreset === "breakout_guard" ? "var(--brand)" : "var(--text-secondary)",
            }}
          >
            突破 + 安全门禁
          </button>
          <button
            type="button"
            onClick={() => setSelectedPreset("chan_bsp")}
            style={{
              padding: "4px 10px",
              borderRadius: 6,
              fontSize: 12,
              cursor: "pointer",
              border: selectedPreset === "chan_bsp" ? "1px solid var(--brand)" : "1px solid var(--border-subtle)",
              background: selectedPreset === "chan_bsp" ? "rgba(43, 169, 192, 0.15)" : "transparent",
              color: selectedPreset === "chan_bsp" ? "var(--brand)" : "var(--text-secondary)",
            }}
          >
            缠论买卖点树
          </button>
        </div>
      </div>

      {selectedPreset === "chan_bsp" ? (
        <div
          style={{
            display: "flex",
            gap: 16,
            flexWrap: "wrap",
            padding: 12,
            background: "var(--surface-base)",
            borderRadius: 6,
            border: "1px solid var(--border-subtle)",
          }}
        >
          <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 8, color: "var(--text-primary)" }}>
            <span>结构级别:</span>
            <select
              value={chanUnits}
              onChange={(e) => setChanUnits(e.target.value)}
              style={{
                padding: "4px 8px",
                background: "var(--surface-raised)",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-primary)",
                borderRadius: 4,
              }}
            >
              <option value="bi">笔级 (Bi)</option>
              <option value="duan">线段级 (Duan)</option>
            </select>
          </label>

          <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 8, color: "var(--text-primary)" }}>
            <span>买卖方向:</span>
            <select
              value={chanDirection}
              onChange={(e) => setChanDirection(e.target.value)}
              style={{
                padding: "4px 8px",
                background: "var(--surface-raised)",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-primary)",
                borderRadius: 4,
              }}
            >
              <option value="buy">看多买点 (Buy Points)</option>
              <option value="sell">看空卖点 (Sell Points)</option>
            </select>
          </label>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* 门禁节点配置 */}
          <div
            style={{
              padding: 12,
              background: "var(--surface-base)",
              borderRadius: 6,
              border: "1px solid var(--border-subtle)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <label
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  cursor: "pointer",
                  color: "var(--text-primary)",
                }}
              >
                <input
                  type="checkbox"
                  checked={enableGuard}
                  onChange={(e) => setEnableGuard(e.target.checked)}
                />
                前置短路门禁节点 (Guard Node)
              </label>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>未通过时直接剪枝，零后续开销</span>
            </div>

            {enableGuard ? (
              <div style={{ display: "flex", gap: 16, alignItems: "center", marginTop: 8 }}>
                <select
                  value={guardPluginId}
                  onChange={(e) => setGuardPluginId(e.target.value)}
                  style={{
                    padding: "4px 8px",
                    background: "var(--surface-raised)",
                    border: "1px solid var(--border-subtle)",
                    color: "var(--text-primary)",
                    borderRadius: 4,
                    flex: 1,
                  }}
                >
                  {plugins && plugins.length > 0 ? (
                    plugins.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.id})
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="plugin.fundamental.safety-guard">基本面财务安全门禁 (ROE & 杠杆)</option>
                      <option value="plugin.regime.market-safety">大盘多空环境门禁</option>
                    </>
                  )}
                </select>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>最低置信度:</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={guardMinConf}
                    onChange={(e) => setGuardMinConf(Number(e.target.value))}
                  />
                  <span className="tnum" style={{ fontSize: 12, color: "var(--text-primary)", width: 36 }}>
                    {(guardMinConf * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            ) : null}
          </div>

          {/* 共识打分节点配置 */}
          <div
            style={{
              padding: 12,
              background: "var(--surface-base)",
              borderRadius: 6,
              border: "1px solid var(--border-subtle)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                局部加权共识打分节点 (Consensus Node)
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>触发阈值:</span>
                <input
                  type="range"
                  min="50"
                  max="95"
                  step="5"
                  value={consensusThreshold}
                  onChange={(e) => setConsensusThreshold(Number(e.target.value))}
                />
                <span
                  className="tnum"
                  style={{ fontSize: 12, color: "var(--sem-success)", fontWeight: 600, width: 36 }}
                >
                  {consensusThreshold}分
                </span>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>放量突破因子权重:</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="range"
                    min="10"
                    max="90"
                    step="5"
                    value={techWeight}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setTechWeight(v);
                      setCapitalWeight(100 - v);
                    }}
                  />
                  <span className="tnum" style={{ fontSize: 12, color: "var(--text-primary)", width: 32 }}>
                    {techWeight}%
                  </span>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>北向资金因子权重:</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="range"
                    min="10"
                    max="90"
                    step="5"
                    value={capitalWeight}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setCapitalWeight(v);
                      setTechWeight(100 - v);
                    }}
                  />
                  <span className="tnum" style={{ fontSize: 12, color: "var(--text-primary)", width: 32 }}>
                    {capitalWeight}%
                  </span>
                </div>
              </div>

              <div style={{ marginTop: 4 }}>
                <label
                  style={{
                    fontSize: 12,
                    color: "var(--sem-warn)",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={enableVeto}
                    onChange={(e) => setEnableVeto(e.target.checked)}
                  />
                  开启外资净流出一票否决权 (Veto Right)
                </label>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
