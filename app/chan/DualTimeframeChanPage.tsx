"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fetchK,
  fetchVisualCommands,
  fetchSecurities,
  type DataSourceValue,
  type SecurityOption,
  type VisualCommandVo,
} from "@/app/api/client";
import dynamic from "next/dynamic";
import type { IFetchK } from "@/app/api/types";
import { formatShanghaiDate, getShanghaiDateParts } from "@/app/lib/time";

const TradingViewChart = dynamic(
  () => import("@/app/components/tv-chart/TradingViewChart"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[320px] flex items-center justify-center bg-surface-raised rounded-lg text-text-muted animate-pulse">
        加载 TradingView 图表...
      </div>
    ),
  }
);

interface TimeframeData {
  k: IFetchK[];
  commands: VisualCommandVo[];
}

export type TimeframeMode = "30m" | "5m";

interface QuickRangeOption {
  id: string;
  label: string;
  isPrimary?: boolean;
  getRange: () => { start: string; end: string };
}

interface ModeConfig {
  key: TimeframeMode;
  title: string;
  tagline: string;
  macroPeriod: number;
  macroBadge: string;
  macroLabel: string;
  macroTitle: string;
  microPeriod: number;
  microBadge: string;
  microLabel: string;
  microTitle: string;
  defaultStart: () => string;
  quickRanges: QuickRangeOption[];
}

const MODE_CONFIGS: Record<TimeframeMode, ModeConfig> = {
  "30m": {
    key: "30m",
    title: "30 分钟级别 (波段主做)",
    tagline: "日线大局观 + 30 分钟次级别中枢嵌套",
    macroPeriod: 1440,
    macroBadge: "1D",
    macroLabel: "日线",
    macroTitle: "日线 K 线走势 · 大级别宏观大局观",
    microPeriod: 30,
    microBadge: "30M",
    microLabel: "30m",
    microTitle: "30 分钟 K 线走势 · 次级别笔与 30m 笔中枢",
    defaultStart: () =>
      formatShanghaiDate(new Date(Date.now() - 180 * 24 * 3600 * 1000)),
    quickRanges: [
      {
        id: "6m",
        label: "近6月 (推荐)",
        isPrimary: true,
        getRange: () => ({
          start: formatShanghaiDate(
            new Date(Date.now() - 180 * 24 * 3600 * 1000)
          ),
          end: formatShanghaiDate(new Date()),
        }),
      },
      {
        id: "3m",
        label: "近3月",
        getRange: () => ({
          start: formatShanghaiDate(
            new Date(Date.now() - 90 * 24 * 3600 * 1000)
          ),
          end: formatShanghaiDate(new Date()),
        }),
      },
      {
        id: "1y",
        label: "近1年",
        getRange: () => ({
          start: formatShanghaiDate(
            new Date(Date.now() - 365 * 24 * 3600 * 1000)
          ),
          end: formatShanghaiDate(new Date()),
        }),
      },
      {
        id: "2025h2",
        label: "2025下半年至今",
        getRange: () => ({
          start: "2025-06-01",
          end: formatShanghaiDate(new Date()),
        }),
      },
      {
        id: "ytd",
        label: "今年以来",
        getRange: () => ({
          start: `${getShanghaiDateParts(new Date()).year}-01-01`,
          end: formatShanghaiDate(new Date()),
        }),
      },
    ],
  },
  "5m": {
    key: "5m",
    title: "5 分钟级别 (日内微观)",
    tagline: "30 分钟大局观 + 5 分钟次级别中枢嵌套",
    macroPeriod: 30,
    macroBadge: "30M",
    macroLabel: "30m",
    macroTitle: "30 分钟 K 线走势 · 大级别大局观",
    microPeriod: 5,
    microBadge: "5M",
    microLabel: "5m",
    microTitle: "5 分钟 K 线微观结构 · 次级别笔与 5m 笔中枢放大镜",
    defaultStart: () => "2026-01-01",
    quickRanges: [
      {
        id: "jan2026",
        label: "2026年1月(大行情)",
        isPrimary: true,
        getRange: () => ({
          start: "2026-01-01",
          end: "2026-01-20",
        }),
      },
      {
        id: "1m",
        label: "近1月",
        getRange: () => ({
          start: formatShanghaiDate(
            new Date(Date.now() - 30 * 24 * 3600 * 1000)
          ),
          end: formatShanghaiDate(new Date()),
        }),
      },
      {
        id: "3m",
        label: "近3月",
        getRange: () => ({
          start: formatShanghaiDate(
            new Date(Date.now() - 90 * 24 * 3600 * 1000)
          ),
          end: formatShanghaiDate(new Date()),
        }),
      },
      {
        id: "ytd",
        label: "今年以来",
        getRange: () => ({
          start: `${getShanghaiDateParts(new Date()).year}-01-01`,
          end: formatShanghaiDate(new Date()),
        }),
      },
    ],
  },
};

const DEFAULT_SOURCE: DataSourceValue = "qmt";
const PRESET_STOCKS = [
  { code: "000001", name: "平安银行" },
  { code: "600519", name: "贵州茅台" },
  { code: "300750", name: "宁德时代" },
  { code: "002594", name: "比亚迪" },
];

export default function DualTimeframeChanPage() {
  const [mode, setMode] = useState<TimeframeMode>("30m");
  const currentConfig = MODE_CONFIGS[mode];

  const [code, setCode] = useState("000001");
  const [source, setSource] = useState<DataSourceValue>(DEFAULT_SOURCE);
  const [startDate, setStartDate] = useState(() => currentConfig.defaultStart());
  const [endDate, setEndDate] = useState(() => formatShanghaiDate(new Date()));

  // 图层开关
  const [showMacroBi, setShowMacroBi] = useState(true);
  const [showMicroBi, setShowMicroBi] = useState(true);
  const [showMicroZs, setShowMicroZs] = useState(true);
  const [showMicroDuan, setShowMicroDuan] = useState(false);

  // 数据状态
  const [dataMacro, setDataMacro] = useState<TimeframeData | null>(null);
  const [dataMicro, setDataMicro] = useState<TimeframeData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // 股票搜索列表
  const [securities, setSecurities] = useState<SecurityOption[]>([]);
  const [stockFilter, setStockFilter] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const requestIdRef = useRef(0);

  useEffect(() => {
    fetchSecurities()
      .then((items) => setSecurities(items))
      .catch(() => {});
  }, []);

  const filteredSecurities = useMemo(() => {
    const q = stockFilter.trim().toLowerCase();
    if (!q) return [];
    return securities
      .filter(
        (s) =>
          s.code.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)
      )
      .slice(0, 15);
  }, [securities, stockFilter]);

  const loadData = useCallback(async () => {
    if (!code || !startDate || !endDate) return;

    const reqId = ++requestIdRef.current;
    setIsLoading(true);
    setErrorMsg("");

    try {
      const [kMacro, visualMacro, kMicro, visualMicro] = await Promise.all([
        fetchK({
          code,
          period: currentConfig.macroPeriod,
          source,
          startDate,
          endDate,
        }),
        fetchVisualCommands({
          code,
          period: currentConfig.macroPeriod,
          source,
          startDate,
          endDate,
          layers: "chan",
        }),
        fetchK({
          code,
          period: currentConfig.microPeriod,
          source,
          startDate,
          endDate,
        }),
        fetchVisualCommands({
          code,
          period: currentConfig.microPeriod,
          source,
          startDate,
          endDate,
          layers: "chan",
          macroPeriod: currentConfig.macroPeriod,
        }),
      ]);

      if (requestIdRef.current !== reqId) return;

      setDataMacro({
        k: kMacro,
        commands: visualMacro.commands,
      });

      setDataMicro({
        k: kMicro,
        commands: visualMicro.commands,
      });
    } catch (err) {
      if (requestIdRef.current !== reqId) return;
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      if (requestIdRef.current === reqId) {
        setIsLoading(false);
      }
    }
  }, [
    code,
    source,
    startDate,
    endDate,
    currentConfig.macroPeriod,
    currentConfig.microPeriod,
  ]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 模式切换
  const handleModeChange = (newMode: TimeframeMode) => {
    if (newMode === mode) return;
    setMode(newMode);
    const newConfig = MODE_CONFIGS[newMode];
    setStartDate(newConfig.defaultStart());
    setEndDate(formatShanghaiDate(new Date()));
  };

  // 动态过滤的指令集（开关切换零网络开销，瞬时响应）
  const displayedCommandsMacro = useMemo(() => {
    if (!dataMacro?.commands) return [];
    return dataMacro.commands.filter((cmd) => {
      if (cmd.layer === "chan_bi") return showMacroBi;
      return false;
    });
  }, [dataMacro?.commands, showMacroBi]);

  const displayedCommandsMicro = useMemo(() => {
    if (!dataMicro?.commands) return [];
    return dataMicro.commands.filter((cmd) => {
      if (cmd.layer === "chan_bi") return showMicroBi;
      if (cmd.layer === "chan_zs_bi") return showMicroZs;
      if (cmd.layer === "chan_duan") return showMicroDuan;
      return false;
    });
  }, [dataMicro?.commands, showMicroBi, showMicroZs, showMicroDuan]);

  // 预设区间选择
  const handleSelectQuickRange = (range: { start: string; end: string }) => {
    setStartDate(range.start);
    setEndDate(range.end);
  };

  // 统计信息
  const countMacroBis =
    dataMacro?.commands.filter((c) => c.layer === "chan_bi").length ?? 0;
  const countMicroBis =
    dataMicro?.commands.filter((c) => c.layer === "chan_bi").length ?? 0;
  const countMicroZs =
    dataMicro?.commands.filter((c) => c.layer === "chan_zs_bi").length ?? 0;

  return (
    <main className="kline-page">
      <header className="kline-header">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <h1 style={{ margin: 0 }}>多周期缠论工作台</h1>
            <span
              style={{
                fontSize: "12px",
                fontWeight: 600,
                background: "rgba(59, 130, 246, 0.15)",
                color: "var(--accent-primary, #3B82F6)",
                padding: "2px 8px",
                borderRadius: "4px",
                border: "1px solid rgba(59, 130, 246, 0.3)",
              }}
            >
              双周期联动 · {currentConfig.tagline}
            </span>
          </div>
          <p style={{ marginTop: "4px", color: "var(--text-secondary)" }}>
            大级别宏观大局观（大笔锁定走势） + 次级别微观结构中枢放大镜（严格嵌套切分）。
          </p>
        </div>
        <nav className="strategy-nav" aria-label="主导航">
          <a href="/k">K 线</a>
          <a href="/chan" aria-current="page">
            多周期缠论
          </a>
          <a href="/strategies">策略</a>
          <a href="/backtests">回测</a>
          <a href="/settings/realtime-subscriptions">实时订阅</a>
        </nav>
      </header>

      {/* 联动模式切换胶囊栏 */}
      <section
        style={{
          maxWidth: "1440px",
          margin: "0 auto 12px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            background: "var(--surface-sunken, #1F2937)",
            padding: "3px",
            borderRadius: "8px",
            border: "1px solid var(--border-subtle, #374151)",
          }}
          role="tablist"
          aria-label="联动级别选择"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === "30m"}
            onClick={() => handleModeChange("30m")}
            style={{
              padding: "6px 14px",
              fontSize: "13px",
              fontWeight: mode === "30m" ? 700 : 500,
              borderRadius: "6px",
              border: "none",
              background:
                mode === "30m"
                  ? "var(--accent-primary, #3B82F6)"
                  : "transparent",
              color: mode === "30m" ? "#fff" : "var(--text-secondary)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              transition: "all 0.15s ease",
            }}
          >
            <span>🎯</span>
            <span>30M 级别联动</span>
            <span
              style={{
                fontSize: "10px",
                background:
                  mode === "30m"
                    ? "rgba(255, 255, 255, 0.25)"
                    : "rgba(59, 130, 246, 0.15)",
                color: mode === "30m" ? "#fff" : "#60A5FA",
                padding: "1px 5px",
                borderRadius: "3px",
              }}
            >
              主做 · 日线+30m中枢
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={mode === "5m"}
            onClick={() => handleModeChange("5m")}
            style={{
              padding: "6px 14px",
              fontSize: "13px",
              fontWeight: mode === "5m" ? 700 : 500,
              borderRadius: "6px",
              border: "none",
              background:
                mode === "5m"
                  ? "var(--accent-primary, #3B82F6)"
                  : "transparent",
              color: mode === "5m" ? "#fff" : "var(--text-secondary)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              transition: "all 0.15s ease",
            }}
          >
            <span>⚡</span>
            <span>5M 级别联动</span>
            <span
              style={{
                fontSize: "10px",
                background:
                  mode === "5m"
                    ? "rgba(255, 255, 255, 0.25)"
                    : "rgba(59, 130, 246, 0.15)",
                color: mode === "5m" ? "#fff" : "#60A5FA",
                padding: "1px 5px",
                borderRadius: "3px",
              }}
            >
              日内 · 30m+5m中枢
            </span>
          </button>
        </div>

        <span style={{ fontSize: "12px", color: "var(--text-muted, #9CA3AF)" }}>
          {mode === "30m"
            ? "当前正观测：上图日线大笔 + 下图 30 分钟笔及日线约束下的 30m 笔中枢"
            : "当前正观测：上图 30 分钟大笔 + 下图 5 分钟笔及 30m 约束下的 5m 笔中枢"}
        </span>
      </section>

      {/* 控制工具栏 */}
      <section className="kline-toolbar" aria-label="查询与控制">
        <div className="field stock-search">
          <label htmlFor="stock-filter">股票搜索</label>
          <input
            id="stock-filter"
            placeholder="输入代码或名称搜索"
            value={stockFilter}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
            onChange={(e) => setStockFilter(e.target.value)}
          />
          {isSearchFocused && filteredSecurities.length > 0 && (
            <div className="stock-results" role="listbox">
              {filteredSecurities.map((s) => (
                <button
                  key={s.code}
                  type="button"
                  onClick={() => {
                    setCode(s.code);
                    setStockFilter("");
                    setIsSearchFocused(false);
                  }}
                >
                  {s.code} {s.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <label className="field">
          股票代码
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.trim())}
            placeholder="代码 (如 000001)"
          />
        </label>

        <label className="field">
          数据源
          <select
            value={source}
            onChange={(e) => setSource(e.target.value as DataSourceValue)}
          >
            <option value="qmt">QMT (实盘/高精度)</option>
            <option value="tdx">TDX</option>
            <option value="ef">东方财富</option>
          </select>
        </label>

        <label className="field">
          开始日期
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </label>

        <label className="field">
          结束日期
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </label>

        <div className="field" style={{ justifyContent: "flex-end" }}>
          <button
            type="button"
            className="action-button"
            onClick={loadData}
            disabled={isLoading}
            style={{
              padding: "8px 16px",
              background: "var(--accent-primary, #3B82F6)",
              color: "#fff",
              borderRadius: "6px",
              fontWeight: 600,
              cursor: isLoading ? "not-allowed" : "pointer",
            }}
          >
            {isLoading ? "加载中..." : "刷新数据"}
          </button>
        </div>
      </section>

      {/* 快捷选择与图层开关条 */}
      <section className="kline-quick-bar">
        <div
          style={{
            display: "flex",
            gap: "8px",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <span className="preset-label">快捷标的:</span>
          {PRESET_STOCKS.map((s) => (
            <button
              key={s.code}
              type="button"
              className={`preset-button ${code === s.code ? "active" : ""}`}
              onClick={() => setCode(s.code)}
              style={{
                padding: "4px 10px",
                fontSize: "12px",
                borderRadius: "4px",
                border: "1px solid var(--border-subtle)",
                background:
                  code === s.code
                    ? "var(--accent-primary, #3B82F6)"
                    : "var(--surface-raised)",
                color: code === s.code ? "#fff" : "var(--text-primary)",
                cursor: "pointer",
              }}
            >
              {s.name} ({s.code})
            </button>
          ))}

          <span className="preset-label" style={{ marginLeft: "12px" }}>
            快捷时间:
          </span>
          {currentConfig.quickRanges.map((r) => {
            const range = r.getRange();
            const isActive =
              startDate === range.start && endDate === range.end;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => handleSelectQuickRange(range)}
                style={{
                  padding: "4px 8px",
                  fontSize: "12px",
                  borderRadius: "4px",
                  border: "1px solid var(--border-subtle)",
                  background: isActive
                    ? "var(--accent-primary, #3B82F6)"
                    : "transparent",
                  color: isActive ? "#fff" : "var(--text-secondary)",
                  cursor: "pointer",
                  fontWeight: r.isPrimary ? 600 : 400,
                }}
              >
                {r.label}
              </button>
            );
          })}
        </div>

        {/* 图层复选开关（动态自适应当前模式级别） */}
        <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "12px",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={showMacroBi}
              onChange={(e) => setShowMacroBi(e.target.checked)}
            />
            <span style={{ color: "#FB923C", fontWeight: 600 }}>
              ● {currentConfig.macroLabel} 笔 (亮橙)
            </span>
          </label>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "12px",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={showMicroBi}
              onChange={(e) => setShowMicroBi(e.target.checked)}
            />
            <span style={{ color: "#FACC15", fontWeight: 600 }}>
              ● {currentConfig.microLabel} 笔 (金黄)
            </span>
          </label>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "12px",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={showMicroZs}
              onChange={(e) => setShowMicroZs(e.target.checked)}
            />
            <span style={{ color: "#38BDF8", fontWeight: 600 }}>
              ■ {currentConfig.microLabel} 笔中枢 (天蓝)
            </span>
          </label>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "12px",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={showMicroDuan}
              onChange={(e) => setShowMicroDuan(e.target.checked)}
            />
            <span style={{ color: "#E879F9" }}>
              {currentConfig.microLabel} 线段
            </span>
          </label>
        </div>
      </section>

      {errorMsg && (
        <div
          style={{
            maxWidth: "1440px",
            margin: "0 auto 12px",
            padding: "10px 14px",
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            color: "#EF4444",
            borderRadius: "6px",
            fontSize: "13px",
          }}
        >
          {errorMsg}
        </div>
      )}

      {/* 双周期分屏展示区 */}
      <div
        style={{
          maxWidth: "1440px",
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        {/* 上方：大级别宏观大局观 */}
        <section
          style={{
            background: "var(--surface-raised)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "8px",
            padding: "14px",
            boxShadow: "0 4px 16px rgb(20 28 40 / 5%)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "10px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span
                style={{
                  background: "#FB923C",
                  color: "#fff",
                  fontSize: "11px",
                  fontWeight: 700,
                  padding: "2px 6px",
                  borderRadius: "4px",
                }}
              >
                {currentConfig.macroBadge}
              </span>
              <h2 style={{ fontSize: "16px", margin: 0, fontWeight: 600 }}>
                {currentConfig.macroTitle}
              </h2>
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
              K 线: {dataMacro?.k.length ?? 0} 根 | {currentConfig.macroLabel}{" "}
              笔: {countMacroBis} 笔
            </div>
          </div>
          <TradingViewChart
            k={dataMacro?.k ?? []}
            commands={displayedCommandsMacro}
            height={280}
            biColor="#FB923C"
            biWidth={2}
          />
        </section>

        {/* 下方：次级别微观结构与中枢放大镜 */}
        <section
          style={{
            background: "var(--surface-raised)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "8px",
            padding: "14px",
            boxShadow: "0 4px 16px rgb(20 28 40 / 5%)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "10px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span
                style={{
                  background: "#3B82F6",
                  color: "#fff",
                  fontSize: "11px",
                  fontWeight: 700,
                  padding: "2px 6px",
                  borderRadius: "4px",
                }}
              >
                {currentConfig.microBadge}
              </span>
              <h2 style={{ fontSize: "16px", margin: 0, fontWeight: 600 }}>
                {currentConfig.microTitle}
              </h2>
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
              K 线: {dataMicro?.k.length ?? 0} 根 | {currentConfig.microLabel}{" "}
              笔: {countMicroBis} 笔 | {currentConfig.microLabel} 笔中枢:{" "}
              {countMicroZs} 个
            </div>
          </div>
          <TradingViewChart
            k={dataMicro?.k ?? []}
            commands={displayedCommandsMicro}
            height={420}
            biColor="#FACC15"
            biWidth={1}
          />
        </section>

        {/* 跨周期对账小贴士面板 */}
        <section
          style={{
            background: "var(--surface-sunken)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "8px",
            padding: "12px 16px",
            fontSize: "12px",
            color: "var(--text-secondary)",
            lineHeight: 1.6,
          }}
        >
          <div
            style={{
              fontWeight: 600,
              color: "var(--text-primary)",
              marginBottom: "4px",
            }}
          >
            💡 跨周期级别嵌套观测指南 ({currentConfig.title})：
          </div>
          {mode === "30m" ? (
            <>
              <div>
                1.{" "}
                <strong>
                  宏观大局观（上图 {currentConfig.macroBadge} 日线）
                </strong>
                ：一根日线上涨或回调大笔（橙色粗线）确立了更高维度的波段大趋势；
              </div>
              <div>
                2.{" "}
                <strong>
                  微观放大镜（下图 {currentConfig.microBadge} 30分钟）
                </strong>
                ：在日线大笔内部，30
                分钟图呈现次级别笔走势与天蓝色的 30m 笔中枢震荡区间；
              </div>
              <div>
                3. <strong>概念解耦</strong>：30 分钟笔中枢天然由日线笔界定所属阶段，杜绝了跨越日线大顶底的腰斩与串联中枢。
              </div>
            </>
          ) : (
            <>
              <div>
                1.{" "}
                <strong>
                  宏观大局观（上图 {currentConfig.macroBadge} 30分钟）
                </strong>
                ：一根 30 分钟向上大笔（橙色粗线）代表了更高维度的日内走势方向；
              </div>
              <div>
                2.{" "}
                <strong>
                  微观放大镜（下图 {currentConfig.microBadge} 5分钟）
                </strong>
                ：在 30 分钟主升笔内部，5
                分钟图呈现清晰的次级别中枢震荡（天蓝色框）；
              </div>
              <div>
                3. <strong>概念解耦</strong>：5 分钟笔中枢天然由 30
                分钟笔确立级别，不再受 5 分钟图上复杂线段切分的干扰。
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
