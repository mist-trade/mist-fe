"use client";

import { useEffect, useState } from "react";
import type { ConnectionStatus } from "../lib/types";
import { formatDateTime, formatRelative } from "../lib/format";

export interface DataFreshnessLabelProps {
  status: ConnectionStatus;
}

/**
 * 数据新鲜度标签：数据时间（固定时区）+ 相对时间 + 时区。
 *
 * 防止 hydration 不一致：
 *  - 绝对时间用 Intl.DateTimeFormat 固定 timeZone（服务端/客户端同结果）
 *  - 相对时间仅在客户端 useEffect 后渲染（SSR 不出相对时间）
 */
export function DataFreshnessLabel({ status }: DataFreshnessLabelProps) {
  const [relative, setRelative] = useState<string | null>(null);

  useEffect(() => {
    const update = () => {
      const diffMs = Date.now() - new Date(status.lastUpdated).getTime();
      setRelative(formatRelative(diffMs / 1000));
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [status.lastUpdated]);

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        fontSize: 13,
        color: "var(--text-muted)",
      }}
    >
      <span className="tnum">
        数据时间 {formatDateTime(status.lastUpdated, status.timezone)}
      </span>
      {relative && (
        <>
          <span>·</span>
          <span>{relative}</span>
        </>
      )}
      <span>·</span>
      <span>{shortTz(status.timezone)}</span>
    </span>
  );
}

/** Asia/Shanghai → CST，简化展示。 */
function shortTz(tz: string): string {
  if (tz === "Asia/Shanghai") return "CST";
  return tz;
}
