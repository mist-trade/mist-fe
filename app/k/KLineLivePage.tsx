"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  collectKLines,
  fetchK,
  fetchVisualCommands,
  fetchSecurities,
  type DataSourceValue,
  type KLineQuery,
  type SecurityOption,
  type VisualCommandVo,
} from "@/app/api/client";
import dynamic from "next/dynamic";
import type { IFetchK } from "@/app/api/types";

const TradingViewChart = dynamic(
  () => import("@/app/components/tv-chart/TradingViewChart"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[550px] flex items-center justify-center bg-surface-raised rounded-lg text-text-muted animate-pulse">
        加载 TradingView 图表...
      </div>
    ),
  }
);

interface VisualChartState {
  k: IFetchK[];
  commands: VisualCommandVo[];
}

const DEFAULT_SOURCE: DataSourceValue = "tdx";
const DEFAULT_PERIOD = 1440;
const SECURITY_SEARCH_LIMIT = 20;
const DATA_SOURCE_VALUES = new Set<DataSourceValue>(["ef", "tdx", "qmt"]);

const PRESET_STOCKS = [
  { code: "600519", name: "贵州茅台" },
  { code: "000001", name: "平安银行" },
  { code: "300750", name: "宁德时代" },
  { code: "002594", name: "比亚迪" },
];

import { formatShanghaiDate, getShanghaiDateParts } from "@/app/lib/time";

function isDataSourceValue(value: string | null): value is DataSourceValue {
  return value !== null && DATA_SOURCE_VALUES.has(value as DataSourceValue);
}

function formatDateToIsoDay(d: Date): string {
  return formatShanghaiDate(d);
}

function todayString() {
  return formatShanghaiDate(new Date());
}

function defaultStartDate() {
  const parts = getShanghaiDateParts(new Date());
  return `${parts.year}-01-01`;
}

function getDefaultQuery(): KLineQuery {
  return {
    code: "",
    source: DEFAULT_SOURCE,
    period: DEFAULT_PERIOD,
    startDate: defaultStartDate(),
    endDate: todayString(),
  };
}

function getQueryFromUrl(): KLineQuery {
  if (typeof window === "undefined") return getDefaultQuery();
  const params = new URLSearchParams(window.location.search);
  const source = params.get("source");
  return {
    code: params.get("code") || "",
    source: isDataSourceValue(source) ? source : DEFAULT_SOURCE,
    period: Number(params.get("period") || DEFAULT_PERIOD),
    startDate: params.get("startDate") || defaultStartDate(),
    endDate: params.get("endDate") || todayString(),
  };
}

function hasCompleteQuery(query: KLineQuery) {
  return Boolean(query.code && query.period && query.startDate && query.endDate);
}

function updateUrl(query: KLineQuery) {
  const params = new URLSearchParams();
  if (query.code) params.set("code", query.code);
  if (query.source) params.set("source", query.source);
  if (query.period) params.set("period", String(query.period));
  if (query.startDate) params.set("startDate", query.startDate);
  if (query.endDate) params.set("endDate", query.endDate);
  window.history.pushState(null, "", `/k?${params.toString()}`);
}

export default function KLineLivePage() {
  const [query, setQuery] = useState<KLineQuery>(getDefaultQuery);
  const [securities, setSecurities] = useState<SecurityOption[]>([]);
  const [stockFilter, setStockFilter] = useState("");
  const [stockError, setStockError] = useState("");
  const [chartError, setChartError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showVolume, setShowVolume] = useState(true);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [chartState, setChartState] = useState<VisualChartState | null>(null);
  const chartRequestIdRef = useRef(0);

  const selectedSecurity = useMemo(
    () => securities.find((item) => item.code === query.code),
    [query.code, securities]
  );

  const filteredSecurities = useMemo(() => {
    const term = stockFilter.trim().toLowerCase();
    if (!term && !isSearchFocused) return [];
    if (!term) return securities.slice(0, SECURITY_SEARCH_LIMIT);
    return securities
      .filter((item) => {
        const code = item.code.toLowerCase();
        const name = item.name.toLowerCase();
        return code.includes(term) || name.includes(term);
      })
      .slice(0, SECURITY_SEARCH_LIMIT);
  }, [securities, stockFilter, isSearchFocused]);


  const setQueryAndUrl = useCallback((updates: Partial<KLineQuery>) => {
    setQuery((current) => {
      const next = { ...current, ...updates };
      updateUrl(next);
      return next;
    });
  }, []);

  const handleQuickRange = (days: number | "ytd") => {
    const end = new Date();
    const endParts = getShanghaiDateParts(end);
    let startDate: string;
    if (days === "ytd") {
      startDate = `${endParts.year}-01-01`;
    } else {
      const past = new Date(Date.now() - days * 24 * 3600 * 1000);
      startDate = formatShanghaiDate(past);
    }
    setQueryAndUrl({
      startDate,
      endDate: endParts.formattedDate,
    });
  };

  const loadChart = useCallback(async (nextQuery: KLineQuery) => {
    const requestId = chartRequestIdRef.current + 1;
    chartRequestIdRef.current = requestId;
    const isCurrentRequest = () => chartRequestIdRef.current === requestId;

    if (!hasCompleteQuery(nextQuery)) {
      setChartState(null);
      setChartError("");
      setStatusMessage("");
      return;
    }

    setIsLoading(true);
    setChartState(null);
    setChartError("");
    setStatusMessage("");

    try {
      const [k, visualRes] = await Promise.all([
        fetchK(nextQuery),
        fetchVisualCommands({
          code: nextQuery.code,
          period: nextQuery.period,
          source: nextQuery.source,
          startDate: nextQuery.startDate,
          endDate: nextQuery.endDate,
        }),
      ]);

      if (!isCurrentRequest()) return;
      if (k.length === 0) {
        setStatusMessage("当前查询没有 K 线数据");
        return;
      }

      setChartState({
        k,
        commands: visualRes.commands,
      });
    } catch (error) {
      if (!isCurrentRequest()) return;
      setChartError(error instanceof Error ? error.message : String(error));
    } finally {
      if (isCurrentRequest()) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    setQuery(getQueryFromUrl());
  }, []);

  useEffect(() => {
    let active = true;
    fetchSecurities()
      .then((items) => {
        if (!active) return;
        setSecurities(items);
        setStockError("");
      })
      .catch((error) => {
        if (!active) return;
        setStockError(error instanceof Error ? error.message : String(error));
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    void loadChart(query);
  }, [query, loadChart]);

  const refreshKLines = async () => {
    if (!query.code) {
      setChartError("请选择股票");
      return;
    }
    if (!query.startDate || !query.endDate) {
      setChartError("请选择日期范围");
      return;
    }

    setIsRefreshing(true);
    setChartError("");
    setStatusMessage("");
    try {
      const result = await collectKLines(query);
      await loadChart(query);
      setStatusMessage(`已刷新 ${result.count} 条 K 线`);
    } catch (error) {
      setChartError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <main className="kline-page">
      <header className="kline-header">
        <div>
          <h1>K 线工作台</h1>
          <p>基于 TradingView Lightweight Charts 的专业金融看盘与缠论分析工作台。</p>
        </div>
        <nav className="strategy-nav" aria-label="主导航">
          <a href="/k" aria-current="page">
            K 线
          </a>
          <a href="/strategies">策略</a>
          <a href="/backtests">回测</a>
          <a href="/settings/realtime-subscriptions">实时订阅</a>
        </nav>
      </header>

      <section className="kline-toolbar" aria-label="K 线查询">
        <div className="field stock-search">
          <label htmlFor="stock-filter">股票</label>
          <input
            id="stock-filter"
            placeholder="搜索代码或名称"
            value={stockFilter}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
            onChange={(event) => setStockFilter(event.target.value)}
          />
          {stockError && <p className="field-error">{stockError}</p>}
          {filteredSecurities.length > 0 && (
            <div className="stock-results" role="listbox">
              {filteredSecurities.map((security) => (
                <button
                  key={security.code}
                  type="button"
                  onClick={() => {
                    setStockFilter("");
                    setIsSearchFocused(false);
                    setQueryAndUrl({ code: security.code });
                  }}
                >
                  {security.code} {security.name}
                </button>
              ))}
            </div>
          )}
        </div>


        <label className="field">
          代码
          <input
            value={query.code}
            onChange={(event) => setQueryAndUrl({ code: event.target.value.trim() })}
          />
        </label>

        <label className="field">
          数据源
          <select
            value={query.source}
            onChange={(event) =>
              setQueryAndUrl({
                source: isDataSourceValue(event.target.value)
                  ? event.target.value
                  : DEFAULT_SOURCE,
              })
            }
          >
            <option value="tdx">TDX</option>
            <option value="ef">东方财富</option>
            <option value="qmt">QMT</option>
          </select>
        </label>

        <label className="field">
          周期
          <select
            value={query.period}
            onChange={(event) => setQueryAndUrl({ period: Number(event.target.value) })}
          >
            <option value={1}>1 分钟</option>
            <option value={5}>5 分钟</option>
            <option value={15}>15 分钟</option>
            <option value={30}>30 分钟</option>
            <option value={60}>60 分钟</option>
            <option value={1440}>日线</option>
          </select>
        </label>

        <label className="field">
          开始
          <input
            type="date"
            value={query.startDate}
            onChange={(event) => setQueryAndUrl({ startDate: event.target.value })}
          />
        </label>

        <label className="field">
          结束
          <input
            type="date"
            value={query.endDate}
            onChange={(event) => setQueryAndUrl({ endDate: event.target.value })}
          />
        </label>

        <button
          type="button"
          className="primary-action"
          onClick={() => void refreshKLines()}
          disabled={isRefreshing}
        >
          刷新 K 线
        </button>
      </section>

      {/* 快捷选择与成交量开关栏 */}
      <section className="kline-quick-bar">
        <div className="quick-presets-row">
          <span className="preset-label">快捷标的:</span>
          {PRESET_STOCKS.map((stock) => (
            <button
              key={stock.code}
              type="button"
              className={`quick-preset-btn ${query.code === stock.code ? "active" : ""}`}
              onClick={() => setQueryAndUrl({ code: stock.code })}
            >
              {stock.name}
            </button>
          ))}
        </div>

        <div className="quick-presets-row">
          <span className="preset-label">快捷区间:</span>
          <button type="button" className="quick-preset-btn" onClick={() => handleQuickRange(7)}>近1周</button>
          <button type="button" className="quick-preset-btn" onClick={() => handleQuickRange(30)}>近1月</button>
          <button type="button" className="quick-preset-btn" onClick={() => handleQuickRange(90)}>近3月</button>
          <button type="button" className="quick-preset-btn" onClick={() => handleQuickRange(180)}>近半年</button>
          <button type="button" className="quick-preset-btn" onClick={() => handleQuickRange(365)}>近1年</button>
          <button type="button" className="quick-preset-btn" onClick={() => handleQuickRange("ytd")}>今年以来</button>
        </div>

        <div className="subchart-toggle">
          <button
            type="button"
            className={showVolume ? "active" : ""}
            onClick={() => setShowVolume(!showVolume)}
          >
            {showVolume ? "📊 成交量 (显示中)" : "📊 成交量 (已隐藏)"}
          </button>
        </div>
      </section>

      <section className="kline-summary" aria-live="polite">
        <strong>{query.code || "未选择股票"}</strong>
        {selectedSecurity && <span>{selectedSecurity.name}</span>}
        {statusMessage && <span>{statusMessage}</span>}
        {chartError && <span className="field-error">{chartError}</span>}
      </section>

      <section className="kline-chart-area" aria-label="K 线图表">
        {!query.code && <div className="empty-state">选择股票后加载 K 线</div>}
        {query.code && isLoading && (
          <div className="w-full h-[550px] flex items-center justify-center bg-surface-raised rounded-lg text-text-muted animate-pulse">
            加载数据与绘制指令中...
          </div>
        )}
        {query.code && !isLoading && !chartState && !chartError && statusMessage && (
          <div className="empty-state">{statusMessage}</div>
        )}
        {chartState && (
          <TradingViewChart
            k={chartState.k}
            commands={chartState.commands}
            height={550}
            subChartType={showVolume ? "volume" : "none"}
          />
        )}
      </section>
    </main>
  );
}
