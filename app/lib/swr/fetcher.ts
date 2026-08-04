"use client";

import useSWR, { type KeyedMutator } from "swr";

/**
 * SWR fetcher 工具：把现有 api/client.ts 的命令式函数包成 SWR hook。
 *
 * 设计：保留 api/client.ts 的 envelope 解析（unwrapApiResponse）与超时，
 * SWR 只负责缓存/去重/重试/轮询。这样既不重写数据层，又拿到 SWR 全部能力。
 *
 * 用法：
 *   const { data, error, isLoading } = useApi(() => fetchSecurities(), {
 *     refreshInterval: 5000, // 实时刷新
 *   });
 */

export interface UseApiOptions {
  /** 轮询间隔（ms），用于实时刷新。 */
  refreshInterval?: number;
  /** 手动禁用。 */
  disabled?: boolean;
  /** 依赖变化时才启用（避免无效请求）。 */
  deps?: unknown[];
}

export interface UseAsyncResult<T> {
  data: T | undefined;
  error: Error | undefined;
  isLoading: boolean;
  /** 手动重新验证。 */
  mutate: KeyedMutator<T>;
}

/**
 * 把一个无参（或已绑参）的 API 函数包成 SWR。
 *
 * key 策略：用函数引用 + deps 作为 key，保证同函数同参复用缓存、
 * 参变时重新请求。deps 变化会改 key，触发重取。
 *
 * @param fetcher 已绑参的 API 函数（如 () => fetchSecurities()）
 * @param options SWR 选项
 */
export function useApi<T>(
  fetcher: () => Promise<T>,
  options: UseApiOptions = {}
): UseAsyncResult<T> {
  const { refreshInterval, disabled, deps = [] } = options;
  // key 包含函数与依赖，disabled 时传 null 停用
  const key = disabled ? null : [fetcher, ...deps];

  const { data, error, isLoading, mutate } = useSWR<T, Error>(
    key,
    () => fetcher(),
    {
      refreshInterval,
      revalidateOnFocus: true,
    }
  );

  return { data, error, isLoading, mutate };
}
