"use client";

import type { KpiMetric } from "../lib/types";
import { formatKpiValue } from "../lib/format";

export interface KpiCardProps {
  metric: KpiMetric;
}

/**
 * KPI 指标卡片。
 *
 * 设计契约：
 *  - 数字 tabular-nums（容器加 .tnum），保证多卡片间小数点对齐
 *  - 盈亏类（isPnl）：正数红（盈）、负数绿（亏），A 股惯例
 *  - 风险类（回撤）：负值用风险色（琥珀）
 *  - 卡片圆角 8、阴影克制、背景 --surface-raised
 */
export function KpiCard({ metric }: KpiCardProps) {
  const valueStr = formatKpiValue(metric);
  const color = resolveColor(metric);

  return (
    <div
      style={{
        background: "var(--surface-raised)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 8,
        padding: 16,
        boxShadow: "var(--shadow-card)",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        minWidth: 0,
      }}
    >
      <span
        style={{
          color: "var(--text-secondary)",
          fontSize: 13,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        {metric.label}
        {metric.sublabel && (
          <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
            · {metric.sublabel}
          </span>
        )}
      </span>
      <span
        className="tnum"
        style={{
          color,
          fontSize: 24,
          fontWeight: 600,
          lineHeight: 1.2,
          letterSpacing: "-0.01em",
        }}
      >
        {valueStr}
      </span>
    </div>
  );
}

/** 按指标语义解析颜色：盈亏用红/绿，回撤用风险色，其余用主文本色。 */
function resolveColor(metric: KpiMetric): string {
  if (metric.key === "dd") return "var(--sem-risk)";
  if (metric.isPnl) {
    if (metric.value > 0) return "var(--sem-profit)";
    if (metric.value < 0) return "var(--sem-loss)";
  }
  return "var(--text-primary)";
}
