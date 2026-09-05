"use client";

import React, { useState, useCallback } from "react";

export interface WorkspaceShellProps {
  /** 左侧边栏内容（配置、搜索、历史等） */
  sidebar: React.ReactNode;
  /** 左侧边栏标题（如 "回测配置与历史"、"标的与参数"） */
  sidebarTitle?: React.ReactNode;
  /** 展开时的侧边栏宽度（默认 320px） */
  sidebarWidth?: number | string;
  /** 右侧主内容区域 */
  children: React.ReactNode;
  /** 默认是否折叠 */
  defaultCollapsed?: boolean;
  /** localStorage 持久化折叠偏好的 key */
  storageKey?: string;
  /** 最外层样式类名 */
  className?: string;
  /** 主区域样式类名 */
  mainClassName?: string;
}

export function WorkspaceShell({
  sidebar,
  sidebarTitle = "控制台",
  sidebarWidth = 320,
  children,
  defaultCollapsed = false,
  storageKey,
  className = "",
  mainClassName = "",
}: WorkspaceShellProps) {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    if (typeof window !== "undefined" && storageKey) {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved !== null) {
          return saved === "true";
        }
      } catch {
        // localStorage not available
      }
    }
    return defaultCollapsed;
  });

  const toggleCollapsed = useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev;
      if (storageKey && typeof window !== "undefined") {
        try {
          localStorage.setItem(storageKey, String(next));
        } catch {
          // localStorage error ignore
        }
      }
      return next;
    });
  }, [storageKey]);

  const widthValue = typeof sidebarWidth === "number" ? `${sidebarWidth}px` : sidebarWidth;

  return (
    <div className={`workspace-shell ${className}`.trim()}>
      {/* 左侧可折叠边栏 */}
      <aside
        className={`workspace-sidebar ${isCollapsed ? "is-collapsed" : ""}`}
        style={!isCollapsed ? { width: widthValue, flex: `0 0 ${widthValue}` } : undefined}
        aria-label="工作台侧边栏"
      >
        <div className="workspace-sidebar-header">
          <div className="workspace-sidebar-title" title={typeof sidebarTitle === "string" ? sidebarTitle : undefined}>
            {sidebarTitle}
          </div>
          <button
            type="button"
            className="workspace-sidebar-toggle"
            onClick={toggleCollapsed}
            title={isCollapsed ? "展开侧栏" : "收起侧栏"}
            aria-label={isCollapsed ? "展开侧栏" : "收起侧栏"}
            aria-expanded={!isCollapsed}
          >
            {isCollapsed ? "▶" : "◀"}
          </button>
        </div>

        {/* 展开态侧边栏主体 */}
        <div className="workspace-sidebar-body">{sidebar}</div>

        {/* 折叠态竖排提示条 */}
        {isCollapsed && (
          <div
            className="workspace-sidebar-collapsed-hint"
            data-testid="workspace-sidebar-collapsed-hint"
            onClick={toggleCollapsed}
            title="点击展开侧栏"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                toggleCollapsed();
              }
            }}
          >
            <span>{typeof sidebarTitle === "string" ? sidebarTitle : "展开侧栏"}</span>
          </div>
        )}
      </aside>

      {/* 右侧主可视化内容区 */}
      <main className={`workspace-main ${mainClassName}`.trim()}>
        {children}
      </main>
    </div>
  );
}

export default WorkspaceShell;
