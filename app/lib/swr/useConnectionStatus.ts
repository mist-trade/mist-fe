"use client";

import { useEffect, useState } from "react";
import type { ConnectionStatus } from "@/app/dashboard/lib/types";

/**
 * 连接状态探测 hook。
 *
 * 状态机：
 *  - online：最近请求成功，延迟 < 500ms
 *  - reconnecting：SWR 广播 request-error 事件后进入，下次成功回 online
 *  - disconnected：连续失败 N 次或延迟探测超时
 *
 * 延迟探测：发一个轻量 HEAD 请求到 /api/mist/health（探测端点），测 RTT。
 * 端点不存在时回退为 online（不阻断 UI）。
 *
 * 与 ConnectionBadge 配合：dashboard 顶部实时反映连接健康度。
 */
const RECONNECT_FAIL_THRESHOLD = 3;

export function useConnectionStatus(
  probeUrl = "/api/mist/health",
  probeIntervalMs = 15000
): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>({
    state: "online",
    latencyMs: 0,
    lastUpdated: new Date().toISOString(),
    timezone:
      typeof Intl !== "undefined"
        ? Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Shanghai"
        : "Asia/Shanghai",
  });
  const [failCount, setFailCount] = useState(0);

  // 延迟探测
  useEffect(() => {
    let cancelled = false;
    const probe = async () => {
      const t0 = Date.now();
      try {
        // HEAD 请求，不下载 body；超时 3s
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 3000);
        await fetch(probeUrl, {
          method: "HEAD",
          signal: ctrl.signal,
          cache: "no-store",
        });
        clearTimeout(timer);
        const latency = Date.now() - t0;
        if (cancelled) return;
        setFailCount(0);
        setStatus((s) => ({
          ...s,
          state: "online",
          latencyMs: latency,
          lastUpdated: new Date().toISOString(),
        }));
      } catch {
        if (cancelled) return;
        setFailCount((c) => {
          const next = c + 1;
          setStatus((s) => ({
            ...s,
            state:
              next >= RECONNECT_FAIL_THRESHOLD ? "disconnected" : "reconnecting",
            lastUpdated: s.lastUpdated,
          }));
          return next;
        });
      }
    };
    probe();
    const id = setInterval(probe, probeIntervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [probeUrl, probeIntervalMs]);

  // 监听 SWR 广播的请求错误事件 → 标记 reconnecting
  useEffect(() => {
    const handler = () => {
      setStatus((s) =>
        s.state === "online" ? { ...s, state: "reconnecting" } : s
      );
    };
    window.addEventListener("mist:request-error", handler);
    return () => window.removeEventListener("mist:request-error", handler);
  }, []);

  return status;
}
