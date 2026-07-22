"use client";

import type { ConnectionStatus } from "../lib/types";

export interface ConnectionBadgeProps {
  status: ConnectionStatus;
}

/**
 * 连接状态徽章：在线/重连中/断连 + 延迟 ms。
 * 语义色：online→success，reconnecting→warn，disconnected→danger。
 */
export function ConnectionBadge({ status }: ConnectionBadgeProps) {
  const { label, color, dot } = stateMeta(status.state);
  const latencyColor = resolveLatencyColor(status.latencyMs);

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "4px 10px",
        borderRadius: 6,
        border: "1px solid var(--border-subtle)",
        background: "var(--surface-raised)",
        fontSize: 13,
        color: "var(--text-secondary)",
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: dot,
          flexShrink: 0,
        }}
        aria-hidden
      />
      <span style={{ color }}>{label}</span>
      <span style={{ color: "var(--text-muted)" }}>·</span>
      <span className="tnum" style={{ color: latencyColor }}>
        {status.latencyMs} ms
      </span>
    </span>
  );
}

function stateMeta(state: ConnectionStatus["state"]): {
  label: string;
  color: string;
  dot: string;
} {
  switch (state) {
    case "online":
      return {
        label: "在线",
        color: "var(--sem-success)",
        dot: "var(--sem-success)",
      };
    case "reconnecting":
      return {
        label: "重连中",
        color: "var(--sem-warn)",
        dot: "var(--sem-warn)",
      };
    case "disconnected":
      return {
        label: "断连",
        color: "var(--sem-danger)",
        dot: "var(--sem-danger)",
      };
  }
}

/** 延迟分级：<200 正常绿，<500 警告橙，≥500 危险红。 */
function resolveLatencyColor(ms: number): string {
  if (ms < 200) return "var(--text-secondary)";
  if (ms < 500) return "var(--sem-warn)";
  return "var(--sem-danger)";
}
