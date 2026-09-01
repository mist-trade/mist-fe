/**
 * 统一时间与时区工具 (Asia/Shanghai)。
 *
 * 设计契约：
 *  - 全局统一使用 Asia/Shanghai（UTC+8）作为 A 股市场时区。
 *  - 格式化一律采用 Intl.DateTimeFormat，杜绝 toLocaleString 跨端 hydration 不一致。
 *  - 页面输入组件（datetime-local）与时间戳转换显式绑定 Asia/Shanghai 偏移。
 */

import type { UTCTimestamp } from "lightweight-charts";

export const ASIA_SHANGHAI_TIMEZONE = "Asia/Shanghai";

const shanghaiDateTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: ASIA_SHANGHAI_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

const shanghaiDateFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: ASIA_SHANGHAI_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const shanghaiTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: ASIA_SHANGHAI_TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

const shanghaiShortFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: ASIA_SHANGHAI_TIMEZONE,
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

function toDate(value?: string | Date | number | null): Date | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * 格式化为北京时间完整日期时间：YYYY-MM-DD HH:mm:ss
 */
export function formatShanghaiDateTime(value?: string | Date | number | null): string {
  const d = toDate(value);
  if (!d) return "-";
  return shanghaiDateTimeFormatter.format(d).replace(/\//g, "-");
}

/**
 * 格式化为北京时间日期：YYYY-MM-DD
 */
export function formatShanghaiDate(value?: string | Date | number | null): string {
  const d = toDate(value);
  if (!d) return "-";
  return shanghaiDateFormatter.format(d).replace(/\//g, "-");
}

/**
 * 格式化为北京时间时分秒：HH:mm:ss
 */
export function formatShanghaiTime(value?: string | Date | number | null): string {
  const d = toDate(value);
  if (!d) return "-";
  return shanghaiTimeFormatter.format(d);
}

/**
 * 格式化为北京时间简短月日时分秒：MM-DD HH:mm:ss
 */
export function formatShanghaiShort(value?: string | Date | number | null): string {
  const d = toDate(value);
  if (!d) return "-";
  return shanghaiShortFormatter.format(d).replace(/\//g, "-");
}

/**
 * 获取指定 Date 在 Asia/Shanghai 时区下的各分量
 */
export function getShanghaiDateParts(d: Date = new Date()) {
  const parts = shanghaiDateTimeFormatter.formatToParts(d);
  const partMap: Record<string, string> = {};
  for (const p of parts) {
    partMap[p.type] = p.value;
  }
  return {
    year: Number(partMap.year),
    month: Number(partMap.month),
    day: Number(partMap.day),
    hour: Number(partMap.hour),
    minute: Number(partMap.minute),
    second: Number(partMap.second),
    formattedDate: `${partMap.year}-${partMap.month}-${partMap.day}`,
    formattedDateTime: `${partMap.year}-${partMap.month}-${partMap.day}T${partMap.hour}:${partMap.minute}:${partMap.second}`,
  };
}

/**
 * 将 Date 转换为适合 `<input type="datetime-local">` 的北京时间字符串：YYYY-MM-DDTHH:mm:ss
 */
export function formatShanghaiLocalDateTimeInput(d: Date = new Date()): string {
  return getShanghaiDateParts(d).formattedDateTime;
}

/**
 * 将用户在 UI 输入的北京时间字符串（如 "2026-05-30T09:30:00" 或 "2026-05-30 09:30:00"）
 * 严格绑定 +08:00 转换为标准 UTC ISO 字符串
 */
export function parseShanghaiDateTimeToIso(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.endsWith("Z") || trimmed.includes("+") || /-\d{2}:\d{2}$/.test(trimmed)) {
    return new Date(trimmed).toISOString();
  }
  const normalized = trimmed.replace(" ", "T");
  const withOffset = `${normalized}+08:00`;
  const d = new Date(withOffset);
  if (isNaN(d.getTime())) {
    throw new RangeError(`Invalid date string for Asia/Shanghai: "${value}"`);
  }
  return d.toISOString();
}

/**
 * 将时间转换为 lightweight-charts 所需的秒级 UTCTimestamp
 */
export function toUTCTimestamp(time: string | Date | number): UTCTimestamp {
  const ms = new Date(time).getTime();
  return Math.floor(ms / 1000) as UTCTimestamp;
}

