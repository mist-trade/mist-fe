/**
 * Institutional Quant Workbench — Design Tokens (SSOT)
 *
 * 这是整个设计系统的唯一事实来源。三处消费同一份值：
 *  1. antd ConfigProvider theme token（见 app/styles/antd-theme.ts）
 *  2. Tailwind v4 @theme inline（见 globals.css，映射 CSS 变量）
 *  3. ECharts registerTheme（见 app/components/charts/echarts-theme.ts）
 *
 * 红线规则（设计契约）：
 *  - 涨跌色恒为红涨绿跌（A股惯例），且不与 success/danger 语义混用。
 *  - 基准/超额用靛蓝/紫，正交于涨跌色族，避免双色图表歧义。
 *  - 深色模式对红/绿/橙统一提亮 8–12% 亮度并降饱和，保证 WCAG AA 文本对比（≥4.5:1）。
 *  - success 绿比 down 绿更深更饱和，避免"绿=成功"与"绿=跌"混淆。
 *  - 任何新颜色必须经 Token，不得裸 hex 进组件。
 */

/** 所有 token 对应的 CSS 变量名（不带 -- 前缀由消费方拼接）。 */
export const TOKEN_NAMES = {
  // 表面 / 中性
  surfaceBase: "--surface-base",
  surfaceRaised: "--surface-raised",
  surfaceOverlay: "--surface-overlay",
  borderSubtle: "--border-subtle",
  borderStrong: "--border-strong",
  textPrimary: "--text-primary",
  textSecondary: "--text-secondary",
  textMuted: "--text-muted",
  // 业务语义
  semUp: "--sem-up",
  semDown: "--sem-down",
  semProfit: "--sem-profit",
  semLoss: "--sem-loss",
  semBenchmark: "--sem-benchmark",
  semExcess: "--sem-excess",
  semRisk: "--sem-risk",
  semWarn: "--sem-warn",
  semDanger: "--sem-danger",
  semSuccess: "--sem-success",
  // 品牌
  brand: "--brand",
  brandFg: "--brand-fg",
  // 缠论结构色
  chanBiValid: "--chan-bi-valid",
  chanBiInvalid: "--chan-bi-invalid",
  chanBiUnknown: "--chan-bi-unknown",
  chanFenxingTop: "--chan-fenxing-top",
  chanFenxingBottom: "--chan-fenxing-bottom",
  chanZhongshuComplete: "--chan-zhongshu-complete",
  chanZhongshuUncomplete: "--chan-zhongshu-uncomplete",
} as const;

/**
 * 浅色色板：token 名 → 具体颜色值。
 * 与 themes.css 中 :root[data-theme="light"] 一一对应，必须保持同步。
 */
export const LIGHT_TOKENS = {
  surfaceBase: "#f7f8fa",
  surfaceRaised: "#ffffff",
  surfaceOverlay: "#ffffff",
  borderSubtle: "#e5e7eb",
  borderStrong: "#cbd3df",
  textPrimary: "#151a24",
  textSecondary: "#5a6472",
  textMuted: "#8b95a5",
  semUp: "#ef5350",
  semDown: "#26a69a",
  semProfit: "#ef5350",
  semLoss: "#26a69a",
  semBenchmark: "#6366f1",
  semExcess: "#8b5cf6",
  semRisk: "#f59e0b",
  semWarn: "#f59e0b",
  semDanger: "#dc2626",
  semSuccess: "#16a34a",
  brand: "#1f7a8c",
  brandFg: "#ffffff",
  chanBiValid: "#00bcd4",
  chanBiInvalid: "#ec407a",
  chanBiUnknown: "#ff9800",
  chanFenxingTop: "#2196f3",
  chanFenxingBottom: "#ff9800",
  chanZhongshuComplete: "#00e676",
  chanZhongshuUncomplete: "#ffab00",
} as const satisfies Record<keyof typeof TOKEN_NAMES, string>;

/**
 * 深色色板：在浅色基础上对红/绿/橙提亮 8–12%、降饱和，保证深底辨识度。
 * 与 themes.css 中 :root[data-theme="dark"] 一一对应，必须保持同步。
 */
export const DARK_TOKENS = {
  surfaceBase: "#0e1116",
  surfaceRaised: "#161b22",
  surfaceOverlay: "#1c2330",
  borderSubtle: "#262d3a",
  borderStrong: "#3a4456",
  textPrimary: "#e6edf3",
  textSecondary: "#9aa7b8",
  textMuted: "#6b7689",
  semUp: "#ff6b6b",
  semDown: "#2dd4bf",
  semProfit: "#ff6b6b",
  semLoss: "#2dd4bf",
  semBenchmark: "#818cf8",
  semExcess: "#a78bfa",
  semRisk: "#fbbf24",
  semWarn: "#fbbf24",
  semDanger: "#f87171",
  semSuccess: "#4ade80",
  brand: "#2ba9c0",
  brandFg: "#0e1116",
  chanBiValid: "#22d3ee",
  chanBiInvalid: "#f472b6",
  chanBiUnknown: "#fbbf24",
  chanFenxingTop: "#60a5fa",
  chanFenxingBottom: "#fbbf24",
  chanZhongshuComplete: "#4ade80",
  chanZhongshuUncomplete: "#fcd34d",
} as const satisfies Record<keyof typeof TOKEN_NAMES, string>;

/** 主题名，与 ECharts registerTheme、next-themes data-theme 一致。 */
export type ThemeName = "light" | "dark";

/**
 * 系统字体栈（无网络依赖，build 时不再拉取远程字体）。
 *  - sans：系统无衬线，中文优先 PingFang/微软雅黑，数字靠 tabular-nums 对齐
 *  - mono：等宽，用于数字列/KPI
 * 所有消费方（globals.css、antd theme、echarts theme）引用这两常量。
 */
export const FONT_SANS =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif";
export const FONT_MONO =
  "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace";

/** 间距阶（4px 基准）。与 antd margin token 对齐。 */
export const SPACING = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

/** 圆角阶。控件 6 / 卡片 8 / 大面板 12 / 图表容器 0。 */
export const RADIUS = {
  none: 0,
  control: 6,
  card: 8,
  panel: 12,
} as const;

/** 动效契约：≤300ms、cubicOut、实时流关动画。 */
export const MOTION = {
  duration: 300,
  easing: "cubicOut",
  /** 实时数据流期间禁用动画以保持视觉稳定。 */
  streamingAnimation: false,
} as const;

/**
 * 按时间自动切换主题的规则：
 *  07:00–18:00（含 07，不含 18）强制 light，否则 dark。
 *  用户手动覆盖后写入 localStorage，优先级最高。
 */
export const TIME_BASED_THEME = {
  lightStartHour: 7,
  /** 不含此小时，即 [7, 18)。 */
  lightEndHour: 18,
  /** localStorage key，存用户手动选择（"light" | "dark"）。 */
  manualOverrideKey: "mist-theme-manual",
} as const;

/**
 * 判断给定小时（0–23）落在 light 时段。
 * 纯函数，供 TimeBasedThemeScript 与测试复用。
 */
export function isLightHour(hour: number): boolean {
  return (
    hour >= TIME_BASED_THEME.lightStartHour &&
    hour < TIME_BASED_THEME.lightEndHour
  );
}
