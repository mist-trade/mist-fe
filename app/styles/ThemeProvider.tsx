"use client";

/**
 * 应用主题 Provider：整合 next-themes + antd ConfigProvider + 主题上下文。
 *
 * 层级：
 *  <ThemeProvider>                      ← 对外暴露（client component）
 *    <next-themes ThemeProvider>        ← 解析 resolvedTheme（light/dark）
 *      <ThemeContext.Provider>          ← 向图表等非 antd 消费方下发主题名
 *        <antd ConfigProvider>          ← antd 组件主题
 *          {children}
 *
 * 主题解析优先级（由 TimeBasedThemeScript + next-themes 共同保证）：
 *  1. 用户手动覆盖（localStorage manualOverrideKey）
 *  2. 本地时间规则（07:00–18:00 light）
 *  （next-themes 的 forcedTheme/system 模式仍可作为回退）
 */
import { useMemo } from "react";
import {
  ThemeProvider as NextThemesProvider,
  useTheme,
  type ThemeProviderProps,
} from "next-themes";
import { ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import { createContext, useContext } from "react";
import { buildAntdTheme } from "./antd-theme";
import type { ThemeName } from "./tokens";

const ThemeContext = createContext<ThemeName>("light");

/** 获取当前主题名（light/dark），供图表等非 antd 消费方使用。 */
export function useThemeName(): ThemeName {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="data-theme"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
      {...props}
    >
      <ResolvedConfigProvider>{children}</ResolvedConfigProvider>
    </NextThemesProvider>
  );
}

/**
 * 从 next-themes useTheme() 读取 resolvedTheme，驱动 antd ConfigProvider。
 * 单独抽组件以保证 useTheme 在 NextThemesProvider 内部调用。
 *
 * SSR 时 resolvedTheme 为 undefined，首渲染按 light 处理，
 * 与 TimeBasedThemeScript 注入的 data-theme 在 hydration 后对齐。
 */
function ResolvedConfigProvider({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();
  const themeName: ThemeName = resolvedTheme === "dark" ? "dark" : "light";
  const antdTheme = useMemo(() => buildAntdTheme(themeName), [themeName]);

  return (
    <ThemeContext.Provider value={themeName}>
      <ConfigProvider theme={antdTheme} locale={zhCN}>
        {children}
      </ConfigProvider>
    </ThemeContext.Provider>
  );
}
