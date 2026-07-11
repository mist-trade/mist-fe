"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  collectKLines,
  fetchBi,
  fetchChannel,
  fetchFenxing,
  fetchK,
  fetchMergeK,
  fetchSecurities,
  type DataSourceValue,
  type KLineQuery,
  type SecurityOption,
} from "@/app/api/client";
import KPanel from "@/app/components/k-panel";
import KPanelSkeleton from "@/app/components/k-panel/skeleton";
import type {
  IFenxing,
  IFetchBi,
  IFetchChannel,
  IFetchK,
  IMergeK,
} from "@/app/api/types";

interface ChartState {
  k: IFetchK[];
  mergeK: Promise<IMergeK[]>;
  bi: Promise<IFetchBi[]>;
  fenxing: Promise<IFenxing[]>;
  channel: Promise<IFetchChannel[]>;
  isFallback: boolean;
}

const DEFAULT_SOURCE: DataSourceValue = "tdx";
const DEFAULT_PERIOD = 1440;
const SECURITY_SEARCH_LIMIT = 20;
const DATA_SOURCE_VALUES = new Set<DataSourceValue>(["ef", "tdx", "qmt"]);

function isDataSourceValue(value: string | null): value is DataSourceValue {
  return value !== null && DATA_SOURCE_VALUES.has(value as DataSourceValue);
}

function todayString() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function defaultStartDate() {
  return `${new Date().getFullYear()}-01-01`;
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

function isDevelopmentFallbackEnabled() {
  // 临时禁用：旧 test-data 已删除，快照机制尚未接入
  // Phase 5 后可改为读取 __fixtures__/snapshots/
  return false;
}

async function loadDevelopmentFallbackData() {
  return [];
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
  const [chart, setChart] = useState<ChartState | null>(null);
  const chartRequestIdRef = useRef(0);

  const selectedSecurity = useMemo(
    () => securities.find((item) => item.code === query.code),
    [query.code, securities]
  );

  const filteredSecurities = useMemo(() => {
    const term = stockFilter.trim().toLowerCase();
    if (!term) return securities.slice(0, SECURITY_SEARCH_LIMIT);
    return securities
      .filter((item) => {
        const code = item.code.toLowerCase();
        const name = item.name.toLowerCase();
        return code.includes(term) || name.includes(term);
      })
      .slice(0, SECURITY_SEARCH_LIMIT);
  }, [securities, stockFilter]);

  const setQueryAndUrl = useCallback((updates: Partial<KLineQuery>) => {
    setQuery((current) => {
      const next = { ...current, ...updates };
      updateUrl(next);
      return next;
    });
  }, []);

  const createChartState = useCallback(
    async (
      k: IFetchK[],
      fallback: boolean,
      nextQuery: KLineQuery
    ): Promise<ChartState> => {
      if (fallback) {
        return {
          k,
          mergeK: Promise.resolve([]),
          bi: Promise.resolve([]),
          fenxing: Promise.resolve([]),
          channel: Promise.resolve([]),
          isFallback: true,
        };
      }

      const mergeKData = await fetchMergeK(nextQuery);
      const biData = await fetchBi(nextQuery);
      const fenxingData = await fetchFenxing(nextQuery);
      const channelData = await fetchChannel(nextQuery);

      return {
        k,
        mergeK: Promise.resolve(mergeKData),
        bi: Promise.resolve(biData),
        fenxing: Promise.resolve(fenxingData),
        channel: Promise.resolve(channelData),
        isFallback: false,
      };
    },
    []
  );

  const loadChart = useCallback(
    async (nextQuery: KLineQuery) => {
      const requestId = chartRequestIdRef.current + 1;
      chartRequestIdRef.current = requestId;
      const isCurrentRequest = () => chartRequestIdRef.current === requestId;

      if (!hasCompleteQuery(nextQuery)) {
        setChart(null);
        setChartError("");
        setStatusMessage("");
        return;
      }

      setIsLoading(true);
      setChart(null);
      setChartError("");
      setStatusMessage("");

      try {
        const k = await fetchK(nextQuery);
        if (!isCurrentRequest()) return;
        if (k.length === 0) {
          setStatusMessage("当前查询没有 K 线数据");
          return;
        }

        const nextChart = await createChartState(k, false, nextQuery);
        if (!isCurrentRequest()) return;
        setChart(nextChart);
      } catch (error) {
        if (!isCurrentRequest()) return;
        if (isDevelopmentFallbackEnabled()) {
          const fallbackData = await loadDevelopmentFallbackData();
          if (!isCurrentRequest()) return;
          setChart(await createChartState(fallbackData, true, nextQuery));
          setStatusMessage("正在显示开发 fallback 数据");
          return;
        }
        setChartError(error instanceof Error ? error.message : String(error));
      } finally {
        if (isCurrentRequest()) {
          setIsLoading(false);
        }
      }
    },
    [createChartState]
  );

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
          <p>查询行情、刷新采集数据并检查缠论结构。</p>
        </div>
        <nav className="strategy-nav" aria-label="主导航">
          <a href="/k" aria-current="page">
            K 线
          </a>
          <a href="/strategies">策略</a>
        </nav>
      </header>

      <section className="kline-toolbar" aria-label="K 线查询">
        <div className="field stock-search">
          <label htmlFor="stock-filter">股票</label>
          <input
            id="stock-filter"
            placeholder="搜索代码或名称"
            value={stockFilter}
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
            <option value="qmt">qmt</option>
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

      <section className="kline-summary" aria-live="polite">
        <strong>{query.code || "未选择股票"}</strong>
        {selectedSecurity && <span>{selectedSecurity.name}</span>}
        {statusMessage && <span>{statusMessage}</span>}
        {chart?.isFallback && <span>开发 fallback</span>}
        {chartError && <span className="field-error">{chartError}</span>}
      </section>

      <section className="kline-chart-area" aria-label="K 线图表">
        {!query.code && <div className="empty-state">选择股票后加载 K 线</div>}
        {query.code && isLoading && <KPanelSkeleton />}
        {query.code && !isLoading && !chart && !chartError && statusMessage && (
          <div className="empty-state">{statusMessage}</div>
        )}
        {chart && (
          <KPanel
            k={chart.k}
            mergeK={chart.mergeK}
            bi={chart.bi}
            fenxing={chart.fenxing}
            channel={chart.channel}
          />
        )}
      </section>
    </main>
  );
}
