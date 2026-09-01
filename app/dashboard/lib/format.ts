/**
 * 量化数值格式化工具。
 *
 * 设计契约：
 *  - 所有数字 tabular-nums（CSS 层保证字体特性）
 *  - 正数显 +，0 不带色不带号
 *  - 千分位逗号
 *  - 百分比默认 2 位小数
 *  - 价格按精度
 *  - 时间固定时区，杜绝 toLocaleString 跨端不一致
 */
import type { KpiMetric } from "./types";
import { formatShanghaiDateTime, ASIA_SHANGHAI_TIMEZONE } from "@/app/lib/time";

/** 千分位 + 固定小数位。 */
export function formatNumber(value: number, decimals = 2): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * 百分比格式化：正数带 +，负数带 -。
 * @param ratio 小数（0.1234 → "+12.34%"）
 */
export function formatPercent(ratio: number, decimals = 2): string {
  const sign = ratio > 0 ? "+" : "";
  return `${sign}${(ratio * 100).toFixed(decimals)}%`;
}

/** 货币格式化（人民币，万元简写）。 */
export function formatCurrency(value: number): string {
  if (Math.abs(value) >= 10000) {
    return `${value >= 0 ? "" : "-"}${formatNumber(
      Math.abs(value) / 10000,
      2
    )} 万`;
  }
  return formatNumber(value, 2);
}

/** 按 KpiMetric.format 调度格式化。 */
export function formatKpiValue(metric: KpiMetric): string {
  const decimals = metric.decimals ?? 2;
  switch (metric.format) {
    case "percent":
      return formatPercent(metric.value, decimals);
    case "currency":
      return formatCurrency(metric.value);
    case "ratio":
      return formatNumber(metric.value, decimals);
    case "number":
    default:
      return formatNumber(metric.value, decimals);
  }
}

/**
 * 固定时区时间格式化，防 hydration 不一致。
 * 服务端/客户端渲染同一 ISO → 同一字符串。
 */
export function formatDateTime(
  iso: string,
  timezone: string = ASIA_SHANGHAI_TIMEZONE,
  opts?: Intl.DateTimeFormatOptions
): string {
  if (
    (!timezone ||
      timezone === ASIA_SHANGHAI_TIMEZONE ||
      timezone === "Asia/Shanghai") &&
    !opts
  ) {
    return formatShanghaiDateTime(iso);
  }
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      ...opts,
      timeZone: timezone || ASIA_SHANGHAI_TIMEZONE,
    }).format(new Date(iso));
  } catch {
    // 时区非法时回退到本地
    return new Date(iso).toISOString();
  }
}

/** 相对时间（"3 秒前"/"2 分钟前"），仅客户端使用。 */
export function formatRelative(seconds: number): string {
  if (seconds < 5) return "刚刚";
  if (seconds < 60) return `${Math.floor(seconds)} 秒前`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} 分钟前`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} 小时前`;
  return `${Math.floor(seconds / 86400)} 天前`;
}
