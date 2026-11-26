"use client";

import { useState, useEffect } from "react";
import type { FactorPluginVo } from "@/app/api/client";

export type DecisionFlowNodeType = "GUARD" | "BRANCH" | "EXTRACTOR" | "TERMINAL";

export interface GuardFlowNode {
  id: string;
  type: "GUARD";
  name: string;
  pluginId: string;
  params?: Record<string, unknown>;
  requiredAction: "BUY" | "SELL" | "BOTH" | "ANY";
  onPass: DecisionFlowNode;
  onFail?: DecisionFlowNode;
}

export interface BranchFlowNode {
  id: string;
  type: "BRANCH";
  name: string;
  condition: {
    attributeKey?: string;
    pluginId?: string;
    operator: "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "in";
    value: unknown;
  };
  branches: {
    true: DecisionFlowNode;
    false: DecisionFlowNode;
  };
}

export interface ExtractorFlowNode {
  id: string;
  type: "EXTRACTOR";
  name: string;
  pluginId: string;
  params?: Record<string, unknown>;
  exportAttributeKey: string;
  next: DecisionFlowNode;
}

export interface TerminalFlowNode {
  id: string;
  type: "TERMINAL";
  action: "BUY" | "SELL" | "ABORT" | "INHERIT";
  signalTag?: string;
  reason?: string;
}

export type DecisionFlowNode =
  | GuardFlowNode
  | BranchFlowNode
  | ExtractorFlowNode
  | TerminalFlowNode;

export interface DecisionFlowBuilderProps {
  plugins: FactorPluginVo[];
  onChange: (flowRule: Record<string, unknown>) => void;
}

type FlowPreset = "standard_guard" | "chan_bsp" | "extractor_branch";

const DEFAULT_GUARD_OPTIONS: ReadonlyArray<{ id: string; name: string }> = [
  { id: "plugin.fundamental.safety-guard", name: "基本面财务安全门禁 (ROE & 杠杆)" },
  { id: "plugin.capital.northbound", name: "北向外资资金流向门禁" },
];

const DEFAULT_PRIMARY_OPTIONS: ReadonlyArray<{ id: string; name: string }> = [
  { id: "plugin.technical.fibonacci", name: "斐波那契黄金分割回撤因子" },
  { id: "plugin.capital.northbound", name: "北向外资加仓异动因子" },
  { id: "plugin.chan.bsp", name: "缠论形态买卖点因子" },
];

function buildDefaultPluginParams(pluginId: string): Record<string, unknown> {
  switch (pluginId) {
    case "plugin.fundamental.safety-guard":
      return { minRoe: 8.0, maxDebtRatio: 70.0 };
    case "plugin.capital.northbound":
      return { minInflowWan: 1000 };
    case "plugin.technical.fibonacci":
      return { units: "bi", direction: "pullback" };
    case "plugin.chan.bsp":
      return {
        units: "bi",
        direction: "buy",
        points: { first: true, second: true, third: true },
        deduplicate: true,
      };
    default:
      return {};
  }
}

export function DecisionFlowBuilder({ plugins, onChange }: DecisionFlowBuilderProps) {
  const [selectedPreset, setSelectedPreset] = useState<FlowPreset>("standard_guard");

  // 前置门禁配置 (GUARD)
  const [enableGuard, setEnableGuard] = useState<boolean>(true);
  const [guardPluginId, setGuardPluginId] = useState<string>("plugin.fundamental.safety-guard");

  // 主信号门禁配置 (GUARD -> TERMINAL)
  const [primaryPluginId, setPrimaryPluginId] = useState<string>("plugin.technical.fibonacci");
  const [primaryAction, setPrimaryAction] = useState<"BUY" | "SELL">("BUY");

  // 特征提取 + 条件分支配置 (EXTRACTOR -> BRANCH -> TERMINAL)
  const [branchThreshold, setBranchThreshold] = useState<number>(1000);

  // 缠论参数
  const [chanUnits, setChanUnits] = useState<"bi" | "duan">("bi");
  const [chanDirection, setChanDirection] = useState<"buy" | "sell">("buy");

  // 生成严格合法的决策树 AST（仅允许 GUARD / BRANCH / EXTRACTOR / TERMINAL 四类节点）
  useEffect(() => {
    let rootNode: DecisionFlowNode;

    if (selectedPreset === "chan_bsp") {
      const action = chanDirection === "sell" ? "SELL" : "BUY";
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
        requiredAction: action,
        onPass: {
          id: "term_chan_pass",
          type: "TERMINAL",
          action,
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
    } else if (selectedPreset === "extractor_branch") {
      rootNode = {
        id: "extract_capital_flow",
        type: "EXTRACTOR",
        name: "北向资金净流入特征提取",
        pluginId: "plugin.capital.northbound",
        params: { minInflowWan: branchThreshold },
        exportAttributeKey: "capital.flow",
        next: {
          id: "branch_capital_threshold",
          type: "BRANCH",
          name: "资金流入阈值条件分支",
          condition: {
            attributeKey: "capital.flow.netInflowWan",
            operator: "gte",
            value: branchThreshold,
          },
          branches: {
            true: {
              id: "term_branch_buy",
              type: "TERMINAL",
              action: "BUY",
              signalTag: "CAPITAL_INFLOW_CONFIRMED",
              reason: `资金净流入达到 ${branchThreshold} 万元阈值`,
            },
            false: {
              id: "term_branch_abort",
              type: "TERMINAL",
              action: "ABORT",
              reason: "资金流入条件未命中，分支短路终止",
            },
          },
        },
      };
    } else {
      // 标准串联门禁决策树：可选前置门禁 (GUARD) -> 核心信号门禁 (GUARD) -> 终结节点 (TERMINAL)
      const primaryGateNode: GuardFlowNode = {
        id: "guard_primary_signal",
        type: "GUARD",
        name: "核心信号因子门禁",
        pluginId: primaryPluginId,
        params: buildDefaultPluginParams(primaryPluginId),
        requiredAction: primaryAction,
        onPass: {
          id: "term_signal_emit",
          type: "TERMINAL",
          action: primaryAction,
          signalTag: "FACTOR_CONFIRMED",
          reason: "前置安全与核心信号门禁均通过，确立信号",
        },
        onFail: {
          id: "term_signal_abort",
          type: "TERMINAL",
          action: "ABORT",
          reason: "核心信号门禁未通过",
        },
      };

      if (enableGuard) {
        rootNode = {
          id: "guard_safety",
          type: "GUARD",
          name: "财务与基本面安全防线",
          pluginId: guardPluginId,
          params: buildDefaultPluginParams(guardPluginId),
          requiredAction: primaryAction,
          onPass: primaryGateNode,
          onFail: {
            id: "term_guard_fail",
            type: "TERMINAL",
            action: "ABORT",
            reason: "前置基本面门禁未通过，直接短路熔断",
          },
        };
      } else {
        rootNode = primaryGateNode;
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
    primaryPluginId,
    primaryAction,
    branchThreshold,
    chanUnits,
    chanDirection,
    onChange,
  ]);

  const guardOptions = plugins && plugins.length > 0 ? plugins : DEFAULT_GUARD_OPTIONS;
  const primaryOptions = plugins && plugins.length > 0 ? plugins : DEFAULT_PRIMARY_OPTIONS;

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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
          决策流树状架构编排器 (Factor Tree Studio)
        </h4>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={() => setSelectedPreset("standard_guard")}
            style={{
              padding: "4px 10px",
              borderRadius: 6,
              fontSize: 12,
              cursor: "pointer",
              border: selectedPreset === "standard_guard" ? "1px solid var(--brand)" : "1px solid var(--border-subtle)",
              background: selectedPreset === "standard_guard" ? "rgba(43, 169, 192, 0.15)" : "transparent",
              color: selectedPreset === "standard_guard" ? "var(--brand)" : "var(--text-secondary)",
            }}
          >
            门禁信号树
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
          <button
            type="button"
            onClick={() => setSelectedPreset("extractor_branch")}
            style={{
              padding: "4px 10px",
              borderRadius: 6,
              fontSize: 12,
              cursor: "pointer",
              border: selectedPreset === "extractor_branch" ? "1px solid var(--brand)" : "1px solid var(--border-subtle)",
              background: selectedPreset === "extractor_branch" ? "rgba(43, 169, 192, 0.15)" : "transparent",
              color: selectedPreset === "extractor_branch" ? "var(--brand)" : "var(--text-secondary)",
            }}
          >
            特征分支树
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
              onChange={(e) => setChanUnits(e.target.value as "bi" | "duan")}
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
              onChange={(e) => setChanDirection(e.target.value as "buy" | "sell")}
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
      ) : selectedPreset === "extractor_branch" ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            padding: 12,
            background: "var(--surface-base)",
            borderRadius: 6,
            border: "1px solid var(--border-subtle)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
              特征提取与分支路由 (EXTRACTOR → BRANCH → TERMINAL)
            </span>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>写入黑板 attributeKey 后执行条件分流</span>
          </div>
          <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 10, color: "var(--text-secondary)" }}>
            <span>北向净流入分支阈值 (万元):</span>
            <input
              type="number"
              min={0}
              step={100}
              value={branchThreshold}
              onChange={(e) => setBranchThreshold(Number(e.target.value) || 0)}
              style={{
                padding: "4px 8px",
                width: 120,
                background: "var(--surface-raised)",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-primary)",
                borderRadius: 4,
              }}
            />
          </label>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* 前置门禁节点配置 */}
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
                前置短路门禁节点 (GUARD)
              </label>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>未通过时直接剪枝，零后续开销</span>
            </div>

            {enableGuard ? (
              <div style={{ display: "flex", gap: 16, alignItems: "center", marginTop: 8 }}>
                <select
                  aria-label="前置门禁插件"
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
                  {guardOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.id})
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>

          {/* 核心信号门禁节点配置 (GUARD -> TERMINAL) */}
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
                核心信号门禁节点 (GUARD → TERMINAL)
              </span>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>确定性规则动作匹配通过后发射信号</span>
            </div>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <select
                aria-label="核心信号因子"
                value={primaryPluginId}
                onChange={(e) => setPrimaryPluginId(e.target.value)}
                style={{
                  padding: "4px 8px",
                  background: "var(--surface-raised)",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--text-primary)",
                  borderRadius: 4,
                  flex: 1,
                }}
              >
                {primaryOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.id})
                  </option>
                ))}
              </select>

              <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 8, color: "var(--text-secondary)" }}>
                <span>目标动作:</span>
                <select
                  aria-label="目标动作"
                  value={primaryAction}
                  onChange={(e) => setPrimaryAction(e.target.value as "BUY" | "SELL")}
                  style={{
                    padding: "4px 8px",
                    background: "var(--surface-raised)",
                    border: "1px solid var(--border-subtle)",
                    color: "var(--text-primary)",
                    borderRadius: 4,
                  }}
                >
                  <option value="BUY">买入 (BUY)</option>
                  <option value="SELL">卖出 (SELL)</option>
                </select>
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
