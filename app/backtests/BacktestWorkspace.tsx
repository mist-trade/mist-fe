"use client";

import { useCallback, useMemo, useState } from "react";
import {
  fetchK,
  fetchVisualCommands,
  fetchStrategyBacktestSignals,
  type StrategyBacktestRun,
  type StrategyBacktestSignalResult,
  type VisualCommandVo,
} from "@/app/api/client";
import type { IFetchK } from "@/app/api/types";
import { BacktestConfigPanel, type BacktestConfigValues } from "./components/BacktestConfigPanel";
import { BacktestRunHistory } from "./components/BacktestRunHistory";
import { BacktestSignalTable } from "./components/BacktestSignalTable";
import { BacktestReplayBar } from "./components/BacktestReplayBar";
import { BacktestMetricsBar } from "./components/BacktestMetricsBar";
import { BacktestLayerToolbar } from "./components/BacktestLayerToolbar";
import { DecisionTraceDrawer } from "@/app/components/DecisionTraceDrawer";
import { WorkspaceShell } from "@/app/components/layout/WorkspaceShell";
import { formatShanghaiDateTime } from "@/app/lib/time";
import TradingViewChart from "@/app/components/tv-chart/TradingViewChart";

import { useBacktestTasks } from "./hooks/useBacktestTasks";
import { useBacktestChartLayers } from "./hooks/useBacktestChartLayers";
import { useBacktestReplay } from "./hooks/useBacktestReplay";
import { convertBacktestSignalsToCommands } from "./utils/backtest-signal-visual.util";


export function BacktestWorkspace() {
  const [selectedSymbol, setSelectedSymbol] = useState<string>("");
  const [signals, setSignals] = useState<StrategyBacktestSignalResult[]>([]);
  const [selectedSignal, setSelectedSignal] = useState<StrategyBacktestSignalResult | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [showVolume, setShowVolume] = useState<boolean>(true);

  // 全量原始走势与全局指令
  const [rawK, setRawK] = useState<IFetchK[]>([]);
  const [fullCommands, setFullCommands] = useState<VisualCommandVo[]>([]);
  const [allSignalCommands, setAllSignalCommands] = useState<VisualCommandVo[]>([]);

  // 1. 图层显示控制 Hook
  const {
    showBi,
    setShowBi,
    showBiZs,
    setShowBiZs,
    showDuan,
    setShowDuan,
    showDuanZs,
    setShowDuanZs,
    showBacktestSignals,
    setShowBacktestSignals,
    showChanBsp,
    setShowChanBsp,
    filterCommandsByLayers,
  } = useBacktestChartLayers();

  // 2. 为指定标的拉取 K 线与图层视觉指令
  const loadChartForRun = useCallback(
    async (
      run: StrategyBacktestRun,
      symbol: string,
      runSignals: StrategyBacktestSignalResult[]
    ): Promise<IFetchK[]> => {
      const symbolSignals = runSignals.filter((s) => s.securityCode === symbol);
      const toVisualQueryDate = (iso: string) =>
        formatShanghaiDateTime(iso).replace(/\//g, "-");
      const visualStart = toVisualQueryDate(run.startDate);
      const visualEnd = toVisualQueryDate(run.endDate);

      const [kLines, visualPayload] = await Promise.all([
        fetchK({
          code: symbol,
          period: run.period,
          source: run.source,
          startDate: visualStart,
          endDate: visualEnd,
        }),
        fetchVisualCommands({
          code: symbol,
          period: run.period,
          source: run.source,
          startDate: visualStart,
          endDate: visualEnd,
        }).catch(() => ({ totalKlines: 0, commands: [] })),
      ]);

      const safeK = Array.isArray(kLines) ? kLines : [];
      const signalCommands = convertBacktestSignalsToCommands(symbolSignals, safeK);
      const pureVisualCommands = (visualPayload.commands || []).filter(
        (cmd) => cmd.layer !== "backtest_signals"
      );
      const mergedCommands = [...pureVisualCommands, ...signalCommands];

      setRawK(safeK);
      setFullCommands(pureVisualCommands);
      setAllSignalCommands(signalCommands);

      setChart({
        symbol,
        k: safeK,
        commands: mergedCommands,
      });

      return safeK;
    },
    []
  );

  // 3. 加载回测记录的信号和图表
  const loadRunSignalsAndChart = useCallback(
    async (run: StrategyBacktestRun, symbol: string): Promise<IFetchK[]> => {
      const pageResult = await fetchStrategyBacktestSignals(run.id).catch(() => ({
        items: [],
        nextCursor: null,
      }));
      const sigList = Array.isArray(pageResult) ? pageResult : pageResult?.items || [];
      setSignals(sigList);

      if (symbol) {
        return await loadChartForRun(run, symbol, sigList);
      }
      return [];
    },
    [loadChartForRun]
  );

  // 4. 回测任务管理 Hook
  const {
    strategies,
    selectedStrategyId,
    versions,
    runs,
    activeRun,
    setActiveRun,
    isRunning,
    statusMessage,
    loadError,
    setLoadError,
    handleSelectStrategyId,
    handleStartBacktest: submitBacktestTask,
    pollRunUntilComplete,
  } = useBacktestTasks({
    onInitialRunLoaded: async (run, firstSymbol) => {
      setSelectedSymbol(firstSymbol);
      try {
        const safeK = await loadRunSignalsAndChart(run, firstSymbol);
        if (safeK && safeK.length > 0) {
          setCursorIndex(safeK.length - 1);
        }
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : String(err));
      }
    },
  });

  // 当前选中标的专属的信号列表
  const symbolSignals = useMemo(() => {
    return signals.filter((s) => s.securityCode === selectedSymbol);
  }, [signals, selectedSymbol]);

  // 标的买卖点信号与 K 线数组的下标对齐索引
  const signalIndices = useMemo(() => {
    if (!rawK || rawK.length === 0 || !symbolSignals || symbolSignals.length === 0) return [];
    const minTime = new Date(rawK[0].time).getTime();
    const maxTime = new Date(rawK[rawK.length - 1].time).getTime();

    return symbolSignals
      .map((sig) => {
        const sigTime = new Date(sig.signalTime).getTime();
        if (sigTime < minTime || sigTime > maxTime) {
          return { signal: sig, index: -1 };
        }
        let idx = rawK.findIndex((item) => new Date(item.time).getTime() === sigTime);
        if (idx < 0) {
          idx = rawK.findIndex((item) => new Date(item.time).getTime() >= sigTime);
        }
        return { signal: sig, index: idx };
      })
      .filter((item) => item.index >= 0)
      .sort((a, b) => a.index - b.index);
  }, [rawK, symbolSignals]);

  const handleSelectReplaySignal = useCallback((sig: StrategyBacktestSignalResult) => {
    setSelectedSignal(sig);
  }, []);

  // 5. 仿真推演复盘 Hook
  const {
    isReplayMode,
    cursorIndex,
    setCursorIndex,
    isPlaying,
    playSpeed,
    replayCommands,
    isDev,
    replaySignalCommands,
    replaySignalIndices,
    handleToggleReplayMode,
    handleStepPrev,
    handleStepNext,
    handleJumpFirst,
    handleJumpLast,
    handleJumpPrevSignal,
    handleJumpNextSignal,
    handleSeek,
    handleTogglePlay,
    handleChangeSpeed,
    resetReplayState,
  } = useBacktestReplay({
    selectedSymbol,
    activeRun,
    rawK,
    signalIndices,
    onSelectSignal: handleSelectReplaySignal,
  });

  // 提交并发起新的回测任务
  const handleStartBacktest = async (values: BacktestConfigValues) => {
    resetReplayState();
    await submitBacktestTask(values, async (completedRun, firstSym) => {
      setSelectedSymbol(firstSym);
      const safeK = await loadRunSignalsAndChart(completedRun, firstSym);
      if (safeK && safeK.length > 0) {
        setCursorIndex(safeK.length - 1);
      }
    });
  };

  // 选择历史回测记录
  const handleSelectRun = async (run: StrategyBacktestRun) => {
    setActiveRun(run);
    setSelectedSignal(null);
    setIsDrawerOpen(false);
    resetReplayState();

    if (run.status === "completed") {
      try {
        const pageResult = await fetchStrategyBacktestSignals(run.id);
        const sigList = Array.isArray(pageResult) ? pageResult : pageResult?.items || [];
        setSignals(sigList);
        const firstSymbol = run.targetUniverse?.[0] || "";
        setSelectedSymbol(firstSymbol);
        if (firstSymbol) {
          const safeK = await loadChartForRun(run, firstSymbol, sigList);
          setCursorIndex(Math.max(0, safeK.length - 1));
        }
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : String(err));
      }
    } else if (run.status === "running" || run.status === "pending") {
      pollRunUntilComplete(run.id, async (completedRun, firstSym) => {
        setSelectedSymbol(firstSym);
        const safeK = await loadRunSignalsAndChart(completedRun, firstSym);
        if (safeK && safeK.length > 0) {
          setCursorIndex(safeK.length - 1);
        }
      });
    }
  };

  // 切换标的查看图表
  const handleSelectSymbol = useCallback(
    async (symbol: string) => {
      setSelectedSymbol(symbol);
      resetReplayState();
      if (activeRun && activeRun.status === "completed") {
        try {
          const safeK = await loadChartForRun(activeRun, symbol, signals);
          setCursorIndex(Math.max(0, safeK.length - 1));
        } catch (err) {
          setLoadError(err instanceof Error ? err.message : String(err));
        }
      }
    },
    [activeRun, signals, loadChartForRun, resetReplayState, setCursorIndex, setLoadError]
  );

  // 信号点击聚焦并打开诊断抽屉，同时在回测模式下瞬移游标切入单步复盘
  const handleSelectSignal = useCallback(
    (sig: StrategyBacktestSignalResult) => {
      setSelectedSignal(sig);
      setIsDrawerOpen(true);
      if (sig.securityCode !== selectedSymbol && activeRun) {
        void handleSelectSymbol(sig.securityCode);
      }
      if (rawK.length > 0) {
        const sigTime = new Date(sig.signalTime).getTime();
        const minTime = new Date(rawK[0].time).getTime();
        const maxTime = new Date(rawK[rawK.length - 1].time).getTime();
        if (sigTime >= minTime && sigTime <= maxTime) {
          let targetIdx = rawK.findIndex((k) => new Date(k.time).getTime() === sigTime);
          if (targetIdx < 0) {
            targetIdx = rawK.findIndex((k) => new Date(k.time).getTime() >= sigTime);
          }
          if (targetIdx >= 0) {
            handleSeek(targetIdx);
          }
        }
      }
    },
    [selectedSymbol, activeRun, rawK, handleSelectSymbol, handleSeek]
  );

  const handleOpenLiveKLine = useCallback((securityCode: string, timestamp: string) => {
    window.open(`/k?code=${securityCode}&focusTime=${encodeURIComponent(timestamp)}`, "_blank");
  }, []);

  const handleToggleVolume = useCallback(() => {
    setShowVolume((prev) => !prev);
  }, []);

  const handleToggleBi = useCallback(() => setShowBi((v) => !v), [setShowBi]);
  const handleToggleBiZs = useCallback(() => setShowBiZs((v) => !v), [setShowBiZs]);
  const handleToggleDuan = useCallback(() => setShowDuan((v) => !v), [setShowDuan]);
  const handleToggleDuanZs = useCallback(() => setShowDuanZs((v) => !v), [setShowDuanZs]);
  const handleToggleBacktestSignals = useCallback(() => setShowBacktestSignals((v) => !v), [setShowBacktestSignals]);
  const handleToggleChanBsp = useCallback(() => setShowChanBsp((v) => !v), [setShowChanBsp]);

  const handleOpenDiagnosis = useCallback(() => {
    const activeList = signalIndices.length > 0 ? signalIndices : replaySignalIndices;
    const activeSig = activeList.find((s) => s.index === cursorIndex)?.signal;
    if (activeSig) {
      setSelectedSignal(activeSig);
      setIsDrawerOpen(true);
    }
  }, [signalIndices, replaySignalIndices, cursorIndex]);

  // 1. 全景视角下的图表对象（不依赖任何游标状态或单步指令，绝对稳定，彻底杜绝全景滑动下的重复计算）
  const fullViewChart = useMemo(() => {
    if (!rawK || rawK.length === 0) return null;
    const minVisibleTimeMs = rawK[0] ? new Date(rawK[0].time).getTime() : 0;
    const maxVisibleTimeMs = rawK[rawK.length - 1]
      ? new Date(rawK[rawK.length - 1].time).getTime()
      : Infinity;
    const inRangeSignalCommands = allSignalCommands.filter((cmd) => {
      if (!cmd.time) return false;
      const cmdTimeMs = new Date(cmd.time).getTime();
      return cmdTimeMs >= minVisibleTimeMs && cmdTimeMs <= maxVisibleTimeMs;
    });
    const all = [...fullCommands, ...inRangeSignalCommands];
    return {
      symbol: selectedSymbol,
      k: rawK,
      commands: filterCommandsByLayers(all),
    };
  }, [selectedSymbol, rawK, fullCommands, allSignalCommands, filterCommandsByLayers]);

  // 2. 单步复盘模式下的动态切片图表对象
  const replayViewChart = useMemo(() => {
    if (!rawK || rawK.length === 0) return null;
    const currentBar = rawK[cursorIndex];
    const currentBarTimeMs = currentBar ? new Date(currentBar.time).getTime() : 0;
    const minVisibleTimeMs = rawK[0] ? new Date(rawK[0].time).getTime() : 0;

    const activeSignalCmds =
      isDev && replaySignalCommands.length > 0
        ? replaySignalCommands
        : allSignalCommands.filter((cmd) => {
            if (!cmd.time) return false;
            const cmdTimeMs = new Date(cmd.time).getTime();
            return cmdTimeMs >= minVisibleTimeMs && cmdTimeMs <= currentBarTimeMs;
          });

    const activeVisualCmds =
      isDev && replayCommands.length > 0
        ? replayCommands
        : fullCommands.filter((cmd) => {
            const rawTime =
              cmd.endTime ?? cmd.toTime ?? cmd.startTime ?? cmd.fromTime ?? cmd.time;
            if (!rawTime) return true;
            const t = new Date(rawTime).getTime();
            return isNaN(t) || t <= currentBarTimeMs;
          });

    const replayAll = [...activeVisualCmds, ...activeSignalCmds];
    return {
      symbol: selectedSymbol,
      k: rawK.slice(0, cursorIndex + 1),
      commands: filterCommandsByLayers(replayAll),
    };
  }, [
    selectedSymbol,
    rawK,
    cursorIndex,
    isDev,
    replayCommands,
    replaySignalCommands,
    fullCommands,
    allSignalCommands,
    filterCommandsByLayers,
  ]);

  const displayedChart = isReplayMode ? replayViewChart : fullViewChart;

  const symbolSignalCounts = useMemo(() => {
    return (signals || []).reduce<Record<string, number>>((acc, s) => {
      acc[s.securityCode] = (acc[s.securityCode] || 0) + 1;
      return acc;
    }, {});
  }, [signals]);

  return (
    <div className="backtest-page">
      <WorkspaceShell
        storageKey="mist_workspace_sidebar_backtests"
        sidebarTitle={<h1 className="workspace-sidebar-title">回测工作台</h1>}
        sidebarWidth={320}
        sidebar={
          <>
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
          </>
        }
      >
        {/* 状态与错误提示 */}
        {(loadError || statusMessage) && (
          <section className="backtest-status-bar" aria-live="polite">
            {statusMessage && <span className="status-msg">{statusMessage}</span>}
            {loadError && <span className="error-msg">{loadError}</span>}
          </section>
        )}

        {/* 指标参数条 + 标的切换 Tabs + K 线图表 + 信号明细表格 */}
        <section className="backtest-main-col">
          {activeRun && (
            <BacktestMetricsBar
              activeRun={activeRun}
              selectedSymbol={selectedSymbol}
              signalCount={signals.length}
              showVolume={showVolume}
              onToggleVolume={handleToggleVolume}
            />
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
                    className={`symbol-tab ${selectedSymbol === symbol ? "active" : ""}`}
                    onClick={() => void handleSelectSymbol(symbol)}
                  >
                    <span>{symbol}</span>
                    {count > 0 && <span className="tab-count-badge">{count}</span>}
                  </button>
                );
              })}
            </div>
          ) : null}

          {/* 图层展示控制栏 */}
          {activeRun && rawK.length > 0 && (
            <BacktestLayerToolbar
              showBi={showBi}
              onToggleBi={handleToggleBi}
              showBiZs={showBiZs}
              onToggleBiZs={handleToggleBiZs}
              showDuan={showDuan}
              onToggleDuan={handleToggleDuan}
              showDuanZs={showDuanZs}
              onToggleDuanZs={handleToggleDuanZs}
              showBacktestSignals={showBacktestSignals}
              onToggleBacktestSignals={handleToggleBacktestSignals}
              showChanBsp={showChanBsp}
              onToggleChanBsp={handleToggleChanBsp}
            />
          )}

          {/* 回测单步推演复盘控制栏 */}
          {activeRun && activeRun.status === "completed" && rawK.length > 0 && (
            <BacktestReplayBar
              isReplayMode={isReplayMode}
              onToggleReplayMode={handleToggleReplayMode}
              cursorIndex={cursorIndex}
              totalBars={rawK.length}
              currentBar={rawK[cursorIndex] || null}
              signalIndices={signalIndices.length > 0 ? signalIndices : replaySignalIndices}
              onStepPrev={handleStepPrev}
              onStepNext={handleStepNext}
              onJumpFirst={handleJumpFirst}
              onJumpLast={handleJumpLast}
              onJumpPrevSignal={handleJumpPrevSignal}
              onJumpNextSignal={handleJumpNextSignal}
              onSeek={handleSeek}
              isPlaying={isPlaying}
              onTogglePlay={handleTogglePlay}
              playSpeed={playSpeed}
              onChangeSpeed={handleChangeSpeed}
              onOpenDiagnosis={handleOpenDiagnosis}
              isDevMode={isDev}
            />
          )}

          {/* 图表展示区 */}
          <div className="backtest-chart-box">
            {!displayedChart ? (
              <div className="empty-state">
                {isRunning
                  ? "回测计算中，完成后将自动呈现 K 线与买卖点标记…"
                  : "请在左侧发起或选择一项回测任务以呈现图表。"}
              </div>
            ) : (
              <TradingViewChart
                k={displayedChart.k}
                commands={displayedChart.commands}
                height={520}
                subChartType={showVolume ? "volume" : "none"}
                replayMode={isReplayMode}
                autoFitOnUpdate={!isReplayMode}
                focusedSignalTime={
                  isReplayMode
                    ? selectedSignal &&
                      rawK[cursorIndex] &&
                      new Date(selectedSignal.signalTime).getTime() ===
                        new Date(rawK[cursorIndex].time).getTime()
                      ? selectedSignal.signalTime
                      : null
                    : selectedSignal?.signalTime ?? null
                }
              />
            )}
          </div>

          {/* 信号列表明细 */}
          {activeRun && activeRun.status === "completed" && (
            <BacktestSignalTable
              signals={signals}
              selectedSignalId={selectedSignal?.id ?? null}
              onSelectSignal={handleSelectSignal}
              onOpenLiveKLine={handleOpenLiveKLine}
            />
          )}
        </section>
      </WorkspaceShell>

      {/* 白盒决策归因与轨迹诊断抽屉 */}
      <DecisionTraceDrawer
        signal={isDrawerOpen ? selectedSignal : null}
        onClose={() => setIsDrawerOpen(false)}
        onOpenLiveKLine={handleOpenLiveKLine}
      />
    </div>
  );
}

export default BacktestWorkspace;
