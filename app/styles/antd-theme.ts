/**
 * antd 主题构建器：把设计 Token 映射到 antd ConfigProvider theme。
 *
 * antd v6 的 token 映射规则（与 v5 一致）：
 *  - colorBgBase / colorTextBase 驱动整套中性色生成
 *  - colorPrimary 驱动品牌色
 *  - colorSuccess/Warning/Error 用语义色覆盖默认绿/黄/红
 *  - borderRadius / fontSize / controlHeight 控制形态
 *
 * 注意：涨跌色（sem-up/down）是业务语义，不进入 antd 默认色板，
 * 组件内通过 CSS 变量 var(--sem-up) 直接消费，避免污染 antd 的 colorSuccess/Error。
 */
import type { ThemeConfig } from "antd";
import { theme as antdTheme } from "antd";
import type { ThemeName } from "./tokens";
import { LIGHT_TOKENS, DARK_TOKENS, RADIUS, FONT_SANS, FONT_MONO } from "./tokens";

const TOKEN_BY_THEME = {
  light: LIGHT_TOKENS,
  dark: DARK_TOKENS,
} as const;

/** 构建 antd ConfigProvider theme，按当前主题。 */
export function buildAntdTheme(themeName: ThemeName): ThemeConfig {
  const t = TOKEN_BY_THEME[themeName];
  const algorithm =
    themeName === "dark"
      ? antdTheme.darkAlgorithm
      : antdTheme.defaultAlgorithm;

  return {
    algorithm,
    token: {
      // 中性色：交给 algorithm 从 base 推导，但锚定前景/背景避免偏差
      colorBgBase: t.surfaceBase,
      colorTextBase: t.textPrimary,
      colorPrimary: t.brand,
      colorSuccess: t.semSuccess,
      colorWarning: t.semWarn,
      colorError: t.semDanger,
      // 形态
      borderRadius: RADIUS.control,
      borderRadiusLG: RADIUS.card,
      fontSize: 14,
      controlHeight: 32,
      controlHeightSM: 24,
      // 系统字体栈（无网络依赖，见 tokens.ts FONT_SANS/FONT_MONO）
      fontFamily: FONT_SANS,
      fontFamilyCode: FONT_MONO,
      // 线条/边框由 algorithm 推导，但锚定 subtle 分隔线
      colorBorder: t.borderSubtle,
      colorBorderSecondary: t.borderSubtle,
    },
    components: {
      Table: {
        // 紧凑行高 36px（中高密度）
        cellPaddingBlock: 8,
        headerBg: t.surfaceBase,
        rowHoverBg: t.surfaceOverlay,
      },
      Card: {
        paddingLG: 16,
      },
      Layout: {
        bodyBg: t.surfaceBase,
        headerBg: t.surfaceRaised,
      },
      Tooltip: {
        colorBgSpotlight: t.surfaceOverlay,
        colorTextLightSolid: t.textPrimary,
      },
    },
  };
}
