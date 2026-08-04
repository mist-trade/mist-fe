"use client";

import { forwardRef } from "react";
import { EmptyState } from "./EmptyState";

export interface ChartContainerProps {
  /** 图表容器高度（px）。K 线默认 600。 */
  height?: number;
  /** 是否处于加载态（显示骨架）。 */
  loading?: boolean;
  /** 是否无数据（显示空态）。 */
  isEmpty?: boolean;
  /** 空态文案，默认"暂无数据"。 */
  emptyText?: string;
  /** 错误信息（显示错误态）。 */
  error?: string | null;
  /** 错误态重试回调。 */
  onRetry?: () => void;
  /** 图表 ref 透传（由各图表的 useChartRender 提供）。 */
  containerRef?: React.Ref<HTMLDivElement>;
  /** aria 标签。 */
  ariaLabel?: string;
  children?: React.ReactNode;
}

/**
 * 图表统一容器：承载尺寸/加载/空/错误态与主题上下文。
 *
 * 所有图表（KPanel、EquityChart、DrawdownChart 等）都应经此容器渲染，
 * 保证状态系统一致。容器本身不创建 ECharts 实例——实例由各图表的
 * useChartRender 在 containerRef 上创建。
 *
 * 视觉：容器背景透明（继承 --surface-raised），无圆角（数据感）。
 */
export const ChartContainer = forwardRef<HTMLDivElement, ChartContainerProps>(
  function ChartContainer(
    {
      height = 600,
      loading,
      isEmpty,
      emptyText = "暂无数据",
      error,
      onRetry,
      containerRef,
      ariaLabel,
      children,
    }
  ) {
    const showLoading = loading && !error;
    const showEmpty = !loading && !error && isEmpty;
    const showError = !!error;

    return (
      <div
        className="chart-container"
        style={{ height, position: "relative" }}
        role="img"
        aria-label={ariaLabel}
      >
        {/* 图表挂载点；containerRef 由各图表 hook 提供 */}
        <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
        {children}

        {showLoading && <ChartSkeleton />}
        {showEmpty && <EmptyState text={emptyText} />}
        {showError && (
          <ChartError message={error ?? "加载失败"} onRetry={onRetry} />
        )}
      </div>
    );
  }
);

/** 图表加载骨架：shimmer 条纹，颜色随主题。 */
function ChartSkeleton() {
  return (
    <div
      className="chart-skeleton"
      style={{
        position: "absolute",
        inset: 0,
        background: "var(--surface-raised)",
      }}
      aria-hidden
    />
  );
}

/** 图表错误态：内联提示 + 重试按钮。 */
function ChartError({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        background: "var(--surface-raised)",
      }}
    >
      <span style={{ color: "var(--sem-danger)", fontSize: 14 }}>
        {message}
      </span>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            padding: "6px 16px",
            border: "1px solid var(--border-strong)",
            borderRadius: 6,
            background: "var(--surface-base)",
            color: "var(--text-primary)",
            cursor: "pointer",
          }}
        >
          重试
        </button>
      )}
    </div>
  );
}
