"use client";

import type { ReactNode } from "react";
import { SWRConfig } from "swr";

/**
 * SWR 全局配置 Provider。
 *
 * 能力：
 *  - 自动重试（指数退避），失败时由 ConnectionBadge 感知
 *  - 请求去重（同 key 多组件挂载只发一次）
 *  - 后台静默刷新（revalidateOnFocus）
 *  - 失败重连探测：通过 onErrorRetry 回调 + 全局错误事件，驱动连接状态
 *
 * provider 不引入具体 fetcher——各业务 hook 自带 fetcher（见 useChartData 等），
 * 这里只设全局策略。
 */
export function SWRProvider({ children }: { children: ReactNode }) {
  return (
    <SWRConfig
      value={{
        // 重试：最多 5 次，退避在 onErrorRetry 内自行 setTimeout 实现
        errorRetryCount: 5,
        // 后台刷新
        revalidateOnFocus: true,
        revalidateOnReconnect: true,
        // 保持已有数据展示，避免刷新时清空（视觉稳定）
        keepPreviousData: true,
        // 失败时不立即抛，保留上次数据；自定义退避重试
        onErrorRetry: (err, key, _config, revalidate, opts) => {
          // 404/401 不重试
          if (String(err?.message).includes("status: 40")) return;
          // 广播连接事件，供 useConnectionStatus 感知
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("mist:request-error", { detail: { key } })
            );
          }
          // 指数退避：1s, 2s, 4s, 8s, 16s，封顶 30s
          const delay = opts.retryCount
            ? Math.min(1000 * 2 ** opts.retryCount, 30000)
            : 1000;
          setTimeout(() => revalidate(opts), delay);
        },
      }}
    >
      {children}
    </SWRConfig>
  );
}
