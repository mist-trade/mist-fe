"use client";

/**
 * 按时间自动切换主题的内联脚本。
 *
 * 在 next-themes 之前执行，写入 localStorage 的手动覆盖优先级最高；
 * 否则按本地时间 07:00–18:00 light、其余 dark。
 *
 * 设计要点：
 *  - 必须是内联 script（在 hydration 前同步执行），避免主题闪烁。
 *  - 用本地时间（用户体感），不用 UTC。
 *  - 手动覆盖写入独立 key，next-themes 的 system 模式仍可用。
 */
import { TIME_BASED_THEME } from "./tokens";

const SCRIPT = `
(function() {
  try {
    var KEY = ${JSON.stringify(TIME_BASED_THEME.manualOverrideKey)};
    var LS = ${JSON.stringify(TIME_BASED_THEME.lightStartHour)};
    var LE = ${JSON.stringify(TIME_BASED_THEME.lightEndHour)};
    var manual = localStorage.getItem(KEY);
    var resolved;
    if (manual === "light" || manual === "dark") {
      resolved = manual;
    } else {
      var h = new Date().getHours();
      resolved = (h >= LS && h < LE) ? "light" : "dark";
    }
    var root = document.documentElement;
    root.setAttribute("data-theme", resolved);
    root.style.colorScheme = resolved;
    // 同步给 next-themes（它读 localStorage "theme"）
    localStorage.setItem("theme", resolved);
  } catch (e) {}
})();
`;

/**
 * 注入防闪烁脚本。放在 <head> 内、next-themes 之前。
 * 用 React 组件封装以便在 layout 中声明式使用。
 */
export function TimeBasedThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
}

/**
 * 记录用户手动选择，覆盖时间规则。
 * 供主题切换 UI 调用。
 */
export function setManualTheme(theme: "light" | "dark") {
  if (typeof window === "undefined") return;
  localStorage.setItem(TIME_BASED_THEME.manualOverrideKey, theme);
  localStorage.setItem("theme", theme);
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.style.colorScheme = theme;
}

/** 清除手动覆盖，回到时间规则驱动。 */
export function clearManualTheme() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TIME_BASED_THEME.manualOverrideKey);
}
