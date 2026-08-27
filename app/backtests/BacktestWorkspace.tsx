"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  listStrategies,
  listStrategyVersions,
  fetchStrategyBacktestRun,
  listStrategyBacktestRuns,
  fetchStrategyBacktestSignals,
  createStrategyBacktest,
  fetchK,
  fetchVisualCommands,
  type StrategyDefinition,
  type StrategyVersion,
  type StrategyBacktestRun,
  type StrategyBacktestSignalResult,
  type VisualCommandVo,
} from "@/app/api/client";
import type { IFetchK } from "@/app/api/types";
import { BacktestConfigPanel, type BacktestConfigValues } from "./components/BacktestConfigPanel";
import { BacktestRunHistory } from "./components/BacktestRunHistory";
import { BacktestSignalTable } from "./components/BacktestSignalTable";
import { ChanDiagnosisDrawer } from "./components/ChanDiagnosisDrawer";

// 动态载入 TradingView Canvas 渲染容器（禁用 SSR 避免 Canvas node 错误）
const TradingViewChart = dynamic(
  () => import("@/app/components/tv-chart/TradingViewChart"),
  { ssr: false, loading: () => <div className="kline-chart-loading">图表引擎加载中…</div> }
);

interface ChartWorkspaceState {
  symbol: string;
  k: IFetchK[];
  commands: VisualCommandVo[];
}

export function BacktestWorkspace() {
  const [strategies, setStrategies] = useState<StrategyDefinition[]>([]);
  const [selectedStrategyId, setSelectedStrategyId] = useState<number | null>(null);
  const [versions, setVersions] = useState<StrategyVersion[]>([]);
  const [runs, setRuns] = useState<StrategyBacktestRun[]>([]);
  const [activeRun, setActiveRun] = useState<StrategyBacktestRun | null>(null);

  const [selectedSymbol, setSelectedSymbol] = useState<string>("");
  const [signals, setSignals] = useState<StrategyBacktestSignalResult[]>([]);
  const [selectedSignal, setSelectedSignal] = useState<StrategyBacktestSignalResult | null>(null);
  const [showVolume, setShowVolume] = useState(true);

  const [chart, setChart] = useState<ChartWorkspaceState | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [loadError, setLoadError] = useState("");

  // 1. 初始化拉取策略列表、版本与历史回测记录
  useEffect(() => {
    let cancelled = false;

    async function initWorkspace() {
      try {
        const stratPromise = typeof listStrategies === "function" ? listStrategies().catch(() => []) : Promise.resolve([]);
        const runPromise = typeof listStrategyBacktestRuns === "function" ? listStrategyBacktestRuns().catch(() => []) : Promise.resolve([]);

        const [stratResult, runResult] = await Promise.all([
          stratPromise,
          runPromise,
        ]);

        if (cancelled) return;
        const strats = Array.isArray(stratResult) ? stratResult : [];
        const runList = Array.isArray(runResult) ? runResult : [];

        setStrategies(strats);
        setRuns(runList);

        if (strats.length > 0) {
          const firstStratId = strats[0].id;
          setSelectedStrategyId(firstStratId);
          if (typeof listStrategyVersions === "function") {
            const versResult = await listStrategyVersions(firstStratId).catch(() => []);
            if (!cancelled) {
              setVersions(Array.isArray(versResult) ? versResult : []);
            }
          }
        }


        if (runList.length > 0) {
          const completedWithSignals = runList.find(
            (r: StrategyBacktestRun) => r.status === "completed" && (r.signalCount ?? 0) > 0
          );
          const firstCompleted =
            completedWithSignals ||
            runList.find((r: StrategyBacktestRun) => r.status === "completed") ||
            runList[0];
          setActiveRun(firstCompleted);
          if (firstCompleted.status === "completed") {
            const firstSymbol = firstCompleted.targetUniverse?.[0] || "";
            setSelectedSymbol(firstSymbol);
            void loadRunSignalsAndChart(firstCompleted, firstSymbol);
          }
        }

      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : String(err));
        }
      }
    }

    void initWorkspace();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  // 2. 当用户主动切换策略时，加载对应版本
  const handleSelectStrategyId = async (id: number) => {
    setSelectedStrategyId(id);
    try {
      const versResult = await listStrategyVersions(id).catch(() => []);
      setVersions(Array.isArray(versResult) ? versResult : []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    }
  };

  // 3. 加载回测记录的信号和图表
  const loadRunSignalsAndChart = async (
    run: StrategyBacktestRun,
    symbol: string
  ) => {
    try {
      setStatusMessage("加载回测买卖点信号与 K 线图表…");
      const fetchedSignals = await fetchStrategyBacktestSignals(run.id).catch(() => []);
      const sigList = Array.isArray(fetchedSignals) ? fetchedSignals : [];
      setSignals(sigList);

      if (symbol) {
        await loadChartForRun(run, symbol, sigList);
      }
      setStatusMessage("");
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
      setStatusMessage("");
    }
  };

  // 4. 为指定标的拉取 K 线与图层视觉指令
  const loadChartForRun = async (
    run: StrategyBacktestRun,
    symbol: string,
    runSignals: StrategyBacktestSignalResult[]
  ) => {
    try {
      const symbolSignals = runSignals.filter((s) => s.securityCode === symbol);

      // 并发拉取 K 线数据与缠论视觉指令
      const [kLines, visualPayload] = await Promise.all([
        fetchK({
          code: symbol,
          period: run.period,
          source: run.source,
          startDate: run.startDate.substring(0, 10),
          endDate: run.endDate.substring(0, 10),
        }),
        fetchVisualCommands({
          code: symbol,
          period: run.period,
          source: run.source,
          startDate: run.startDate.substring(0, 10),
          endDate: run.endDate.substring(0, 10),
        }).catch(() => ({ totalKlines: 0, commands: [] })),
      ]);

      // 将回测信号转化为视觉 Marker 指令
      const signalCommands: VisualCommandVo[] = symbolSignals.map((sig) => {
        const ctx = (sig.contextSnapshot || {}) as Record<string, unknown>;
        const rawType = String(ctx.type || ctx.signalKind || "signal");
        const isSell = rawType.includes("sell") || rawType === "exit";

        let label = "买点";
        if (rawType === "first_buy") label = "1买";
        else if (rawType === "first_sell") label = "1卖";
        else if (rawType === "second_buy") label = "2买";
        else if (rawType === "second_sell") label = "2卖";
        else if (rawType === "third_buy") label = "3买";
        else if (rawType === "third_sell") label = "3卖";

        return {
          id: `backtest_sig_${sig.id}`,
          type: "text",
          layer: "backtest_signals",
          time: sig.signalTime,
          text: label,
          position: isSell ? "above" : "below",
          color: isSell ? "#22C55E" : "#EF4444",
        };
      });

      const mergedCommands = [...(visualPayload.commands || []), ...signalCommands];

      setChart({
        symbol,
        k: kLines,
        commands: mergedCommands,
      });
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    }
  };

  // 轮询回测执行状态
  const pollRunUntilComplete = (runId: number) => {
    setIsRunning(true);
    setStatusMessage(`回测任务 #${runId} 执行计算中…`);

    let timer: ReturnType<typeof setInterval> | null = null;


    const checkOnce = async () => {
      try {
        const current = await fetchStrategyBacktestRun(runId);
        if (current) {
          setActiveRun(current);
          setRuns((prev) => {
            const index = prev.findIndex((r) => r.id === runId);
            if (index >= 0) {
              const copy = [...prev];
              copy[index] = current;
              return copy;
            }
            return [current, ...prev];
          });

          if (current.status === "completed") {
            if (timer) clearInterval(timer);
            setIsRunning(false);
            setStatusMessage(`回测任务 #${runId} 计算完成！`);
            const firstSym = current.targetUniverse?.[0] || "";
            setSelectedSymbol(firstSym);
            await loadRunSignalsAndChart(current, firstSym);
            setTimeout(() => setStatusMessage(""), 3000);
            return;
          } else if (current.status === "failed") {
            if (timer) clearInterval(timer);
            setIsRunning(false);
            setLoadError(`回测任务 #${runId} 计算失败: ${current.errorMessage || "未知错误"}`);
            setStatusMessage("");
            return;
          }
        }
      } catch (err) {
        if (timer) clearInterval(timer);
        setIsRunning(false);
        setLoadError(err instanceof Error ? err.message : String(err));
      }
    };

    void checkOnce();
    timer = setInterval(() => {
      void checkOnce();
    }, 500);
  };



  // 提交并发起新的回测任务
  const handleStartBacktest = async (values: BacktestConfigValues) => {
    setLoadError("");
    try {
      setStatusMessage("正在提交回测计算任务…");
      const receipt = await createStrategyBacktest({
        strategyVersionId: values.strategyVersionId,
        targetUniverse: values.targetUniverse,
        period: values.period,
        source: values.source,
        startDate: values.startDate,
        endDate: values.endDate,
      });

      const runId = receipt?.runId;
      if (!runId) {
        throw new Error("后端未返回有效的回测任务 runId");
      }

      const placeholderRun: StrategyBacktestRun = {
        id: runId,
        strategyDefinitionId: selectedStrategyId || 0,
        strategyVersionId: values.strategyVersionId,
        targetUniverse: values.targetUniverse,
        period: values.period,
        source: values.source,
        startDate: values.startDate,
        endDate: values.endDate,
        status: "pending",
        signalCount: 0,
        matchedSecurityCount: 0,
        createdAt: new Date().toISOString(),
      };

      setRuns((prev) => [placeholderRun, ...prev]);
      setActiveRun(placeholderRun);
      pollRunUntilComplete(runId);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
      setStatusMessage("");
    }
  };

  // 选择历史回测记录
  const handleSelectRun = async (run: StrategyBacktestRun) => {
    setActiveRun(run);
    setSelectedSignal(null);

    if (run.status === "completed") {
      try {
        const fetchedSignals = await fetchStrategyBacktestSignals(run.id);
        const sigList = Array.isArray(fetchedSignals) ? fetchedSignals : [];
        setSignals(sigList);
        const firstSymbol = run.targetUniverse?.[0] || "";
        setSelectedSymbol(firstSymbol);
        if (firstSymbol) {
          await loadChartForRun(run, firstSymbol, sigList);
        }
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : String(err));
      }
    } else if (run.status === "running" || run.status === "pending") {
      pollRunUntilComplete(run.id);
    }
  };

  // 切换标的查看图表
  const handleSelectSymbol = async (symbol: string) => {
    setSelectedSymbol(symbol);
    if (activeRun && activeRun.status === "completed") {
      await loadChartForRun(activeRun, symbol, signals);
    }
  };

  // 信号点击聚焦并打开诊断抽屉
  const handleSelectSignal = (sig: StrategyBacktestSignalResult) => {
    setSelectedSignal(sig);
    if (sig.securityCode !== selectedSymbol && activeRun) {
      void handleSelectSymbol(sig.securityCode);
    }
  };

  const symbolSignalCounts = (signals || []).reduce<Record<string, number>>((acc, s) => {
    acc[s.securityCode] = (acc[s.securityCode] || 0) + 1;
    return acc;
  }, {});

  return (
    <main className="backtest-page">
      {/* 顶部标题区与主导航 */}
      <header className="kline-header">
        <div>
          <h1>回测工作台</h1>
          <p>
            基于 TradingView 硬件加速画布，执行多标的与历史区间策略回测，全图层毫秒级复盘缠论与买卖点。
          </p>
        </div>
        <nav className="strategy-nav" aria-label="主导航">
          <a href="/k">K 线</a>
          <a href="/strategies">策略</a>
          <a href="/backtests" aria-current="page">
            回测
          </a>
          <a href="/settings/realtime-subscriptions">实时订阅</a>
        </nav>
      </header>

      {/* 状态与错误提示 */}
      {(loadError || statusMessage) && (
        <section className="backtest-status-bar" aria-live="polite">
          {statusMessage && <span className="status-msg">{statusMessage}</span>}
          {loadError && <span className="error-msg">{loadError}</span>}
        </section>
      )}

      {/* 主工作区双栏布局 */}
      <section className="backtest-shell">
        {/* 左侧：回测配置表单 + 历史记录 */}
        <aside className="backtest-sidebar-col">
          <BacktestConfigPanel
            strategies={strategies}
            selectedStrategyId={selectedStrategyId}
            onSelectStrategyId={handleSelectStrategyId}
            versions={versions}
            onSubmit={handleStartBacktest}
            isRunning={isRunning}
          />
          <BacktestRunHistory
            runs={runs}
            activeRunId={activeRun?.id ?? null}
            onSelectRun={handleSelectRun}
          />
        </aside>

        {/* 右侧：指标参数条 + 标的切换 Tabs + K 线图表 + 信号明细表格 */}
        <section className="backtest-main-col">
          {activeRun && (
            <div className="backtest-metrics-bar">
              <div className="metrics-bar-left">
                <strong>#{activeRun.id} 回测复盘</strong>
                <span className="info-pill">{selectedSymbol || activeRun.targetUniverse?.[0]}</span>
                <span className="info-pill">{activeRun.period} 分钟</span>
                <span className="info-pill">{activeRun.source.toUpperCase()}</span>
                <span className="info-pill tnum">
                  {activeRun.startDate.substring(0, 10)} ~ {activeRun.endDate.substring(0, 10)}
                </span>
                <span className="signal-count-badge">
                  🎯 命中信号: {signals.length} 个
                </span>
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
            </div>
          )}

          {/* 多标的快速切换 Tabs */}
          {activeRun && activeRun.targetUniverse?.length > 1 ? (
            <div className="symbol-tabs-bar" role="tablist">
              {activeRun.targetUniverse.map((symbol) => {
                const count = symbolSignalCounts[symbol] || 0;
                return (
                  <button
                    key={symbol}
                    type="button"
                    role="tab"
                    aria-selected={selectedSymbol === symbol}
                    className={`symbol-tab ${
                      selectedSymbol === symbol ? "active" : ""
                    }`}
                    onClick={() => void handleSelectSymbol(symbol)}
                  >
                    <span>{symbol}</span>
                    {count > 0 && <span className="tab-count-badge">{count}</span>}
                  </button>
                );
              })}
            </div>
          ) : null}

          {/* 图表展示区 */}
          <div className="backtest-chart-box">
            {!chart ? (
              <div className="empty-state">
                {isRunning
                  ? "回测计算中，完成后将自动呈现 K 线与买卖点标记…"
                  : "请在左侧发起或选择一项回测任务以呈现图表。"}
              </div>
            ) : (
              <TradingViewChart
                k={chart.k}
                commands={chart.commands}
                height={520}
                subChartType={showVolume ? "volume" : "none"}
                focusedSignalTime={selectedSignal?.signalTime ?? null}
              />
            )}
          </div>

          {/* 信号列表明细 */}
          {activeRun && activeRun.status === "completed" && (
            <BacktestSignalTable
              signals={signals}
              selectedSignalId={selectedSignal?.id ?? null}
              onSelectSignal={handleSelectSignal}
            />
          )}
        </section>
      </section>

      {/* 缠论中枢与背驰下钻诊断抽屉 */}
      <ChanDiagnosisDrawer
        signal={selectedSignal}
        onClose={() => setSelectedSignal(null)}
      />
    </main>
  );
}

export default BacktestWorkspace;
