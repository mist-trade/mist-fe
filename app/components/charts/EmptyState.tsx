"use client";

import type { ReactNode } from "react";

export interface EmptyStateProps {
  text?: string;
  /** 可选操作节点（如重试按钮）。 */
  action?: ReactNode;
}

/**
 * 统一空态组件：图标 + 文案 + 可选操作。
 * 取代散落在各页面的"暂无…"字符串。
 */
export function EmptyState({ text = "暂无数据", action }: EmptyStateProps) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        color: "var(--text-muted)",
        fontSize: 14,
        background: "var(--surface-raised)",
      }}
    >
      <EmptyIcon />
      <span>{text}</span>
      {action}
    </div>
  );
}

/** 简洁的空态图标（用当前文本色，避免引入图标库的依赖）。 */
function EmptyIcon() {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 40 40"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      opacity={0.4}
      aria-hidden
    >
      <rect x="6" y="6" width="28" height="28" rx="4" />
      <path d="M12 26 L18 18 L24 24 L28 20" strokeLinecap="round" />
    </svg>
  );
}
