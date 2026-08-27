"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  createStrategyBacktest,
  fetchK,
  fetchVisualCommands,
  fetchStrategyBacktestRun,
  fetchStrategyBacktestSignals,
  listStrategies,
  listStrategyVersions,
  type DataSourceValue,
  type StrategyBacktestRun,
  type StrategyBacktestSignalResult,
  type StrategyDefinition,
  type StrategyVersion,
  type VisualCommandVo,
} from "@/app/api/client";
import type { IFetchK } from "@/app/api/types";
import {
  BacktestConfigPanel,
  type BacktestConfigValues,
} from "./components/BacktestConfigPanel";
import { BacktestRunHistory } from "./components/BacktestRunHistory";
import { BacktestSignalTable } from "./components/BacktestSignalTable";
import { ChanDiagnosisDrawer } from "./components/ChanDiagnosisDrawer";

// 懒加载 TradingViewChart，防止在服务端渲染 SSR
const TradingViewChart = dynamic(
  () => import("@/app/components/tv-chart/TradingViewChart"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[520px] flex items-center justify-center bg-surface-raised rounded-lg text-text-muted animate-pulse">
        加载 TradingView 回测图表...
      </div>
    ),
  }
);

interface BacktestChartState {
  k: IFetchK[];
  commands: VisualCommandVo[];
}

export function BacktestWorkspace() {
  const [strategies, setStrategies] = useState<StrategyDefinition[]>([]);
  const [selectedStrategyId, setSelectedStrategyId] = useState<number | null>(null);
  const [versions, setVersions] = useState<StrategyVersion[]>([]);
  const [runs, setRuns] = useState<StrategyBacktestRun[]>([]);
  const [activeRun, setActiveRun] = useState<StrategyBacktestRun | null>(null);
  const [signals, setSignals] = useState<StrategyBacktestSignalResult[]>([]);
  const [selectedSignal, setSelectedSignal] =
    useState<StrategyBacktestSignalResult | null>(null);
  const [selectedSymbol, setSelectedSymbol] = useState<string>("");

  const [isRunning, setIsRunning] = useState(false);
  const [chart, setChart] = useState<BacktestChartState | null>(null);

  const [loadError, setLoadError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 初始化拉取策略列表
  useEffect(() => {
    let active = true;
    listStrategies()
      .then((defs) => {
        if (!active) return;
        setStrategies(defs);
        if (defs.length > 0) {
          setSelectedStrategyId(defs[0].id);
        }
      })
      .catch((err) => {
        if (!active) return;
        setLoadError(err instanceof Error ? err.message : String(err));
      });

    return () => {
      active = false;
    };
  }, []);

  // 策略变更后加载版本列表
  useEffect(() => {
    if (!selectedStrategyId) {
      setVersions([]);
      return;
    }
    let active = true;
    listStrategyVersions(selectedStrategyId)
      .then((vers) => {
        if (!active) return;
        setVersions(vers);
      })
      .catch((err) => {
        if (!active) return;
        setLoadError(err instanceof Error ? err.message : String(err));
      });

    return () => {
      active = false;
    };
  }, [selectedStrategyId]);

  // 加载回测图表数据（K 线 + 视觉指令 + 回测信号）
  const loadChartForRun = useCallback(
    async (
      run: StrategyBacktestRun,
      targetCode: string,
      signalResults: StrategyBacktestSignalResult[]
    ) => {
      setLoadError("");
      setChart(null);
      setStatusMessage("正在加载 K 线与全图层缠论结构…");
      try {
        const query = {
          code: targetCode,
          source: run.source as DataSourceValue,
          period: run.period,
          startDate: run.startDate.split("T")[0],
          endDate: run.endDate.split("T")[0],
        };

        const [k, visualRes] = await Promise.all([
          fetchK(query),
          fetchVisualCommands({
            code: targetCode,
            period: run.period,
            source: run.source as DataSourceValue,
            startDate: query.startDate,
            endDate: query.endDate,
          }),
        ]);

        if (k.length === 0) {
          setStatusMessage("该时间段无可用 K 线数据");
          return;
        }

        // 过滤属于当前标的的信号并转换为 VisualCommand
        const signalCommands: VisualCommandVo[] = signalResults
          .filter((s) => s.securityCode === targetCode)
          .map((s) => {
            const rawType = String(s.contextSnapshot?.type || "");
            const isSell =
              rawType.includes("sell") ||
              rawType.includes("exit") ||
              rawType.includes("卖");
            return {
              id: `backtest_sig_${s.id}`,
              type: "text" as const,
              layer: "chan_bsp",
              time: s.signalTime,
              price: (s.contextSnapshot?.price as number | undefined) ?? undefined,
              text: isSell ? "卖" : "买",
              position: isSell ? ("above" as const) : ("below" as const),
              color: isSell ? "#22C55E" : "#EF4444",
            };
          });

        const mergedCommands = [...visualRes.commands, ...signalCommands];

        setChart({
          k,
          commands: mergedCommands,
        });

        setStatusMessage(
          `已加载 ${targetCode} 的 ${k.length} 根 K 线，共触发 ${signalCommands.length} 个买卖点`
        );
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : String(err));
        setStatusMessage("");
      }
    },
    []
  );

  // 轮询回测任务直至完成
  const pollRunUntilComplete = useCallback(
    (runId: number) => {
      if (!runId || isNaN(runId)) {
        console.error("Invalid runId provided to pollRunUntilComplete:", runId);
        return;
      }

      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current);
      }

      setIsRunning(true);
      setStatusMessage(`回测任务 #${runId} 正在排队执行…`);

      const check = async () => {
        try {
          const run = await fetchStrategyBacktestRun(runId);
          setActiveRun(run);

          // 更新 runs 列表中该项
          setRuns((prev) =>
            prev.map((item) => (item.id === run.id ? run : item))
          );

          if (run.status === "completed") {
            if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
            setIsRunning(false);

            const fetchedSignals = await fetchStrategyBacktestSignals(run.id);
            setSignals(fetchedSignals);

            const firstSymbol = run.targetUniverse[0] || "";
            setSelectedSymbol(firstSymbol);

            if (firstSymbol) {
              await loadChartForRun(run, firstSymbol, fetchedSignals);
            }
          } else if (run.status === "failed") {
            if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
            setIsRunning(false);
            setLoadError(`回测任务失败: ${run.errorMessage || "未知异常"}`);
            setStatusMessage("");
          }
        } catch (err) {
          if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
          setIsRunning(false);
          setLoadError(err instanceof Error ? err.message : String(err));
        }
      };

      const intervalMs = process.env.NODE_ENV === "test" ? 30 : 300;
      pollingTimerRef.current = setInterval(check, intervalMs);
      void check();
    },
    [loadChartForRun]
  );

  // 清除轮询定时器
  useEffect(() => {
    return () => {
      if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
    };
  }, []);

  // 提交并发起回测
  const handleStartBacktest = async (values: BacktestConfigValues) => {
    setLoadError("");
    setStatusMessage("正在提交回测任务…");
    try {
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
    setLoadError("");

    if (run.status === "completed") {
      try {
        const fetchedSignals = await fetchStrategyBacktestSignals(run.id);
        setSignals(fetchedSignals);
        const firstSymbol = run.targetUniverse[0] || "";
        setSelectedSymbol(firstSymbol);
        if (firstSymbol) {
          await loadChartForRun(run, firstSymbol, fetchedSignals);
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

  // 信号点击聚焦与打开诊断抽屉
  const handleSelectSignal = (sig: StrategyBacktestSignalResult) => {
    setSelectedSignal(sig);
    if (sig.securityCode !== selectedSymbol && activeRun) {
      void handleSelectSymbol(sig.securityCode);
    }
  };

  return (
    <main className="backtest-workspace-page">
      {/* 顶部标题区与主导航 */}
      <header className="kline-header">
        <div>
          <h1>回测工作台</h1>
          <p>
            配置多标的与历史区间，执行缠论与策略回测，全图层可视化复盘买卖点。
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
      <section className="backtest-main-grid">
        {/* 左侧：回测配置表单 + 历史记录 */}
        <aside className="backtest-sidebar">
          <BacktestConfigPanel
            strategies={strategies}
            selectedStrategyId={selectedStrategyId}
            onSelectStrategyId={setSelectedStrategyId}
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

        {/* 右侧：标的切换 Tabs + K 线图表 + 信号明细表格 */}
        <section className="backtest-content-area">
          {/* 多标的快速切换 Tabs */}
          {activeRun && activeRun.targetUniverse?.length > 1 ? (
            <div className="symbol-tabs-bar" role="tablist">
              {activeRun.targetUniverse.map((symbol) => (
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
                  {symbol}
                </button>
              ))}
            </div>
          ) : null}

          {/* 图表展示区 */}
          <div className="kline-chart-area backtest-chart-box">
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
