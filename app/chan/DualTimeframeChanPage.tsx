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

const DEFAULT_SOURCE: DataSourceValue = "qmt";
const PRESET_STOCKS = [
  { code: "000001", name: "平安银行" },
  { code: "600519", name: "贵州茅台" },
  { code: "300750", name: "宁德时代" },
  { code: "002594", name: "比亚迪" },
];

export default function DualTimeframeChanPage() {
  const [code, setCode] = useState("000001");
  const [source, setSource] = useState<DataSourceValue>(DEFAULT_SOURCE);
  const [startDate, setStartDate] = useState("2026-01-01");
  const [endDate, setEndDate] = useState(() => formatShanghaiDate(new Date()));

  // 图层开关
  const [show30mBi, setShow30mBi] = useState(true);
  const [show5mBi, setShow5mBi] = useState(true);
  const [show5mZs, setShow5mZs] = useState(true);
  const [show5mDuan, setShow5mDuan] = useState(false);

  // 数据状态
  const [data30m, setData30m] = useState<TimeframeData | null>(null);
  const [data5m, setData5m] = useState<TimeframeData | null>(null);
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
      // 构造 30m 图层
      const layers30m = ["chan_bi"];
      // 构造 5m 图层
      const layers5m: string[] = [];
      if (show5mBi) layers5m.push("chan_bi");
      if (show5mZs) layers5m.push("chan_zs_bi");
      if (show5mDuan) layers5m.push("chan_duan");

      const [k30, visual30, k5, visual5] = await Promise.all([
        fetchK({ code, period: 30, source, startDate, endDate }),
        fetchVisualCommands({
          code,
          period: 30,
          source,
          startDate,
          endDate,
          layers: layers30m.join(","),
        }),
        fetchK({ code, period: 5, source, startDate, endDate }),
        fetchVisualCommands({
          code,
          period: 5,
          source,
          startDate,
          endDate,
          layers: layers5m.length > 0 ? layers5m.join(",") : "chan_bi",
        }),
      ]);

      if (requestIdRef.current !== reqId) return;

      setData30m({
        k: k30,
        commands: show30mBi ? visual30.commands : [],
      });

      setData5m({
        k: k5,
        commands: visual5.commands.filter((cmd) => {
          if (cmd.layer === "chan_bi" && !show5mBi) return false;
          if (cmd.layer === "chan_zs_bi" && !show5mZs) return false;
          if (cmd.layer === "chan_duan" && !show5mDuan) return false;
          return true;
        }),
      });
    } catch (err) {
      if (requestIdRef.current !== reqId) return;
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      if (requestIdRef.current === reqId) {
        setIsLoading(false);
      }
    }
  }, [code, source, startDate, endDate, show30mBi, show5mBi, show5mZs, show5mDuan]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 预设区间
  const handleSetQuickRange = (type: "jan2026" | "1m" | "3m" | "ytd") => {
    const today = new Date();
    const end = formatShanghaiDate(today);
    let start = "2026-01-01";

    if (type === "jan2026") {
      setStartDate("2026-01-01");
      setEndDate("2026-01-20");
      return;
    }
    if (type === "1m") {
      const past = new Date(today.getTime() - 30 * 24 * 3600 * 1000);
      start = formatShanghaiDate(past);
    } else if (type === "3m") {
      const past = new Date(today.getTime() - 90 * 24 * 3600 * 1000);
      start = formatShanghaiDate(past);
    } else if (type === "ytd") {
      const parts = getShanghaiDateParts(today);
      start = `${parts.year}-01-01`;
    }

    setStartDate(start);
    setEndDate(end);
  };

  // 统计信息
  const count30mBis =
    data30m?.commands.filter((c) => c.layer === "chan_bi").length ?? 0;
  const count5mBis =
    data5m?.commands.filter((c) => c.layer === "chan_bi").length ?? 0;
  const count5mZs =
    data5m?.commands.filter((c) => c.layer === "chan_zs_bi").length ?? 0;

  return (
    <main className="kline-page">
      <header className="kline-header">
        <div>
          <h1>多周期缠论工作台</h1>
          <p>
            双周期分屏联动视角：上方 30 分钟大级别大局观（宏观笔） + 下方 5 分钟微观结构放大镜（笔与笔中枢嵌套）。
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
          {filteredSecurities.length > 0 && (
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
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
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
                background: code === s.code ? "var(--accent-primary, #3B82F6)" : "var(--surface-raised)",
                color: code === s.code ? "#fff" : "var(--text-primary)",
                cursor: "pointer",
              }}
            >
              {s.name} ({s.code})
            </button>
          ))}

          <span className="preset-label" style={{ marginLeft: "12px" }}>时间区间:</span>
          <button
            type="button"
            onClick={() => handleSetQuickRange("jan2026")}
            style={{
              padding: "4px 8px",
              fontSize: "12px",
              borderRadius: "4px",
              border: "1px solid var(--border-subtle)",
              background: startDate === "2026-01-01" && endDate === "2026-01-20" ? "var(--accent-primary, #3B82F6)" : "transparent",
              color: startDate === "2026-01-01" && endDate === "2026-01-20" ? "#fff" : "var(--text-secondary)",
              cursor: "pointer",
            }}
          >
            2026年1月(大行情)
          </button>
          <button
            type="button"
            onClick={() => handleSetQuickRange("1m")}
            style={{
              padding: "4px 8px",
              fontSize: "12px",
              borderRadius: "4px",
              border: "1px solid var(--border-subtle)",
              background: "transparent",
              color: "var(--text-secondary)",
              cursor: "pointer",
            }}
          >
            近1月
          </button>
          <button
            type="button"
            onClick={() => handleSetQuickRange("3m")}
            style={{
              padding: "4px 8px",
              fontSize: "12px",
              borderRadius: "4px",
              border: "1px solid var(--border-subtle)",
              background: "transparent",
              color: "var(--text-secondary)",
              cursor: "pointer",
            }}
          >
            近3月
          </button>
        </div>

        {/* 图层复选开关 */}
        <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={show30mBi}
              onChange={(e) => setShow30mBi(e.target.checked)}
            />
            <span style={{ color: "#FB923C", fontWeight: 600 }}>● 30m 笔 (亮橙)</span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={show5mBi}
              onChange={(e) => setShow5mBi(e.target.checked)}
            />
            <span style={{ color: "#FACC15", fontWeight: 600 }}>● 5m 笔 (金黄)</span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={show5mZs}
              onChange={(e) => setShow5mZs(e.target.checked)}
            />
            <span style={{ color: "#38BDF8", fontWeight: 600 }}>■ 5m 笔中枢 (天蓝)</span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={show5mDuan}
              onChange={(e) => setShow5mDuan(e.target.checked)}
            />
            <span style={{ color: "#E879F9" }}>5m 线段</span>
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
        {/* 上方：30分钟宏观大局观 */}
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
                30M
              </span>
              <h2 style={{ fontSize: "16px", margin: 0, fontWeight: 600 }}>
                30 分钟 K 线走势 · 大级别大局观
              </h2>
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
              K 线: {data30m?.k.length ?? 0} 根 | 30m 笔: {count30mBis} 笔
            </div>
          </div>
          <TradingViewChart
            k={data30m?.k ?? []}
            commands={data30m?.commands ?? []}
            height={280}
            biColor="#FB923C"
            biWidth={2}
          />
        </section>

        {/* 下方：5分钟微观结构与中枢放大镜 */}
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
                5M
              </span>
              <h2 style={{ fontSize: "16px", margin: 0, fontWeight: 600 }}>
                5 分钟 K 线微观结构 · 次级别笔与笔中枢放大镜
              </h2>
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
              K 线: {data5m?.k.length ?? 0} 根 | 5m 笔: {count5mBis} 笔 | 5m 笔中枢: {count5mZs} 个
            </div>
          </div>
          <TradingViewChart
            k={data5m?.k ?? []}
            commands={data5m?.commands ?? []}
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
          <div style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>
            💡 跨周期级别嵌套观测指南：
          </div>
          <div>
            1. <strong>宏观大局观（上图 30M）</strong>：一根 30 分钟向上大笔（橙色粗线）代表了更高维度的走势方向；
          </div>
          <div>
            2. <strong>微观放大镜（下图 5M）</strong>：在 30 分钟主升笔内部，5 分钟图呈现清晰的次级别中枢震荡（天蓝色框）；
          </div>
          <div>
            3. <strong>概念解耦</strong>：5 分钟笔中枢天然由 30 分钟笔确立级别，不再受 5 分钟图上复杂线段切分的干扰。
          </div>
        </section>
      </div>
    </main>
  );
}
