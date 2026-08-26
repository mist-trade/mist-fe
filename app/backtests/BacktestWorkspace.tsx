"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  createStrategyBacktest,
  fetchBi,
  fetchChannel,
  fetchDuan,
  fetchDuanChannel,
  fetchFenxing,
  fetchK,
  fetchMergeK,
  fetchStrategyBacktestRun,
  fetchStrategyBacktestSignals,
  listStrategies,
  listStrategyVersions,
  type DataSourceValue,
  type StrategyBacktestRun,
  type StrategyBacktestSignalResult,
  type StrategyDefinition,
  type StrategyVersion,
} from "@/app/api/client";
import type {
  IFenxing,
  IFetchBi,
  IFetchChannel,
  IFetchDuan,
  IFetchDuanChannel,
  IFetchK,
  IMergeK,
} from "@/app/api/types";
import type {
  BspSignalMappedData,
  BspSignalSourceData,
  SubChartType,
} from "@/app/components/k-panel/types";
import KPanelSkeleton from "@/app/components/k-panel/skeleton";
import {
  BacktestConfigPanel,
  type BacktestConfigValues,
} from "./components/BacktestConfigPanel";
import { BacktestRunHistory } from "./components/BacktestRunHistory";
import { BacktestSignalTable } from "./components/BacktestSignalTable";
import { ChanDiagnosisDrawer } from "./components/ChanDiagnosisDrawer";

// 懒加载 KPanel，防止在服务端渲染 SSR
const KPanel = dynamic(() => import("@/app/components/k-panel"), {
  ssr: false,
  loading: () => <KPanelSkeleton />,
});

interface BacktestChartState {
  k: IFetchK[];
  mergeK: Promise<IMergeK[]>;
  bi: Promise<IFetchBi[]>;
  fenxing: Promise<IFenxing[]>;
  channel: Promise<IFetchChannel[]>;
  duan: Promise<IFetchDuan[]>;
  duanChannel: Promise<IFetchDuanChannel[]>;
  signals: BspSignalSourceData[];
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
  const [subChartType, setSubChartType] = useState<SubChartType>("volume");
  const [chart, setChart] = useState<BacktestChartState | null>(null);
  const [focusedSignalTime, setFocusedSignalTime] = useState<string | null>(null);

  const [loadError, setLoadError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 初始化拉取策略定义列表
  useEffect(() => {
    let active = true;
    listStrategies()
      .then((items) => {
        if (!active) return;
        setStrategies(items);
        if (items.length > 0) {
          setSelectedStrategyId(items[0].id);
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

  // 联动拉取选定策略的版本
  useEffect(() => {
    if (!selectedStrategyId) return;
    let active = true;
    listStrategyVersions(selectedStrategyId)
      .then((items) => {
        if (!active) return;
        setVersions(items);
      })
      .catch((err) => {
        if (!active) return;
        setLoadError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      active = false;
    };
  }, [selectedStrategyId]);

  // 加载指定标的与运行区间的图表与缠论全图层数据
  const loadChartForRun = useCallback(
    async (
      run: StrategyBacktestRun,
      targetCode: string,
      signalResults: StrategyBacktestSignalResult[]
    ) => {
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

        const k = await fetchK(query);
        if (k.length === 0) {
          setStatusMessage("该时间段无可用 K 线数据");
          return;
        }

        const mergeKData = await fetchMergeK(query);
        const biData = await fetchBi(query);
        const fenxingData = await fetchFenxing(query);
        const channelData = await fetchChannel(query);
        const duanData = await fetchDuan(query);
        const duanChannelData = await fetchDuanChannel(query);

        // 过滤属于当前标的的信号
        const matchedSignals: BspSignalSourceData[] = signalResults
          .filter((s) => s.securityCode === targetCode)
          .map((s) => ({
            id: s.id,
            securityCode: s.securityCode,
            signalTime: s.signalTime,
            price: (s.contextSnapshot?.price as number | undefined) ?? undefined,
            type: (s.contextSnapshot?.type as string | undefined) ?? undefined,
            contextSnapshot: s.contextSnapshot,
            ruleSnapshot: s.ruleSnapshot,
          }));

        setChart({
          k,
          mergeK: Promise.resolve(mergeKData),
          bi: Promise.resolve(biData.phaseB),
          fenxing: Promise.resolve(fenxingData),
          channel: Promise.resolve(channelData.phaseB),
          duan: Promise.resolve(duanData),
          duanChannel: Promise.resolve(duanChannelData.phaseB),
          signals: matchedSignals,
        });

        setStatusMessage(
          `已加载 ${targetCode} 的 ${k.length} 根 K 线，共触发 ${matchedSignals.length} 个买卖点`
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
      };

      setRuns((prev) => [placeholderRun, ...prev.filter((r) => r.id !== runId)]);
      setActiveRun(placeholderRun);
      pollRunUntilComplete(runId);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
      setStatusMessage("");
    }
  };

  // 切换历史任务
  const handleSelectHistoryRun = async (run: StrategyBacktestRun) => {
    setActiveRun(run);
    setSelectedSignal(null);
    setFocusedSignalTime(null);

    if (run.status === "running" || run.status === "pending") {
      pollRunUntilComplete(run.id);
      return;
    }

    if (run.status === "completed") {
      const fetchedSignals = await fetchStrategyBacktestSignals(run.id);
      setSignals(fetchedSignals);
      const symbol = run.targetUniverse[0] || "";
      setSelectedSymbol(symbol);
      if (symbol) {
        await loadChartForRun(run, symbol, fetchedSignals);
      }
    }
  };

  // 点击信号行：居中聚焦并打开诊断抽屉
  const handleSelectSignal = (signal: StrategyBacktestSignalResult) => {
    setSelectedSignal(signal);
    setFocusedSignalTime(signal.signalTime);
  };

  // 点击图表中的买卖点 Pin
  const handleChartSignalClick = (bsp: BspSignalMappedData) => {
    const matched = signals.find((s) => s.id === bsp.rawSignal.id);
    if (matched) {
      setSelectedSignal(matched);
    } else {
      setSelectedSignal({
        id: bsp.bspId,
        backtestRunId: activeRun?.id ?? 0,
        securityCode: bsp.rawSignal.securityCode || selectedSymbol,
        signalTime: bsp.time,
        contextSnapshot: bsp.rawSignal.contextSnapshot || {},
        ruleSnapshot: bsp.rawSignal.ruleSnapshot || {},
      });
    }
  };

  return (
    <main className="backtest-page">
      <header className="strategy-header">
        <div>
          <h1>回测可视化工作台</h1>
          <p>多周期回测任务驱动、全图层缠论形态可视化与中枢背驰诊断。</p>
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

      {loadError ? <p className="strategy-error">{loadError}</p> : null}
      {statusMessage ? <p className="strategy-muted">{statusMessage}</p> : null}

      <section className="backtest-shell">
        {/* 左侧：回测配置表单 + 历史任务记录 */}
        <aside className="backtest-sidebar-col">
          <BacktestConfigPanel
            strategies={strategies}
            versions={versions}
            selectedStrategyId={selectedStrategyId}
            onSelectStrategyId={setSelectedStrategyId}
            isRunning={isRunning}
            onSubmit={handleStartBacktest}
          />

          <BacktestRunHistory
            runs={runs}
            activeRunId={activeRun?.id ?? null}
            onSelectRun={handleSelectHistoryRun}
          />
        </aside>

        {/* 右侧主工作区：运行指标栏 + K线缠论图表 + 信号结果明细 */}
        <section className="backtest-main-col">
          {/* 指标栏 */}
          {activeRun ? (
            <div className="backtest-metrics-bar">
              <strong>任务 #{activeRun.id}</strong>
              <span className={`status-badge status-${activeRun.status}`}>
                {activeRun.status.toUpperCase()}
              </span>
              <span>周期: {activeRun.period}m</span>
              <span>数据源: {activeRun.source}</span>
              <span className="tnum">信号总数: {activeRun.signalCount}</span>
              <span className="tnum">命中标的: {activeRun.matchedSecurityCount}</span>

              {activeRun.targetUniverse.length > 1 && (
                <label className="symbol-switcher">
                  切换标的:
                  <select
                    value={selectedSymbol}
                    onChange={(e) => {
                      const code = e.target.value;
                      setSelectedSymbol(code);
                      void loadChartForRun(activeRun, code, signals);
                    }}
                  >
                    {activeRun.targetUniverse.map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <div className="subchart-toggle">
                <button
                  type="button"
                  className={subChartType === "volume" ? "active" : ""}
                  onClick={() => setSubChartType("volume")}
                >
                  成交量
                </button>
                <button
                  type="button"
                  className={subChartType === "macd" ? "active" : ""}
                  onClick={() => setSubChartType("macd")}
                >
                  MACD 力度
                </button>
              </div>
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
              <KPanel
                k={chart.k}
                mergeK={chart.mergeK}
                bi={chart.bi}
                fenxing={chart.fenxing}
                channel={chart.channel}
                duan={chart.duan}
                duanChannel={chart.duanChannel}
                signals={chart.signals}
                subChartType={subChartType}
                onSignalClick={handleChartSignalClick}
                focusedSignalTime={focusedSignalTime}
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
