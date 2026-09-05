"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { BacktestReplayBar } from "./components/BacktestReplayBar";
import { WorkspaceShell } from "@/app/components/layout/WorkspaceShell";
import { formatShanghaiDate, formatShanghaiDateTime } from "@/app/lib/time";

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

  // 全量原始走势与全局指令
  const [rawK, setRawK] = useState<IFetchK[]>([]);
  const [fullCommands, setFullCommands] = useState<VisualCommandVo[]>([]);
  const [allSignalCommands, setAllSignalCommands] = useState<VisualCommandVo[]>([]);

  // 单步推演复盘控制状态
  const [isReplayMode, setIsReplayMode] = useState<boolean>(false);
  const [cursorIndex, setCursorIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playSpeed, setPlaySpeed] = useState<number>(500);
  const [replayCommands, setReplayCommands] = useState<VisualCommandVo[]>([]);
  const replayCommandsCache = useRef<Map<string, VisualCommandVo[]>>(new Map());
  const activeReplayReqId = useRef<number>(0);

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

      // 并发拉取 K 线数据与缠论视觉指令（时分秒精度，修复 substring(0,10) 截断 Bug）
      const toVisualQueryDate = (iso: string) =>
        formatShanghaiDateTime(iso).replace(/\//g, '-');
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

      setRawK(kLines);
      setFullCommands(visualPayload.commands || []);
      setAllSignalCommands(signalCommands);
      setCursorIndex(Math.max(0, kLines.length - 1));
      setReplayCommands(visualPayload.commands || []);
      setIsPlaying(false);

      // Seed cache for the completed end date
      const visualEndKey = toVisualQueryDate(run.endDate);
      replayCommandsCache.current.set(visualEndKey, visualPayload.commands || []);

      // 预热该标的的所有信号关键帧，确保单步跳转零网络延迟秒切
      for (const sig of symbolSignals) {
        const timeKey = toVisualQueryDate(sig.signalTime);
        if (!replayCommandsCache.current.has(timeKey)) {
          void fetchVisualCommands({
            code: symbol,
            period: run.period,
            source: run.source,
            startDate: visualStart,
            endDate: timeKey,
          })
            .then((res) => {
              replayCommandsCache.current.set(timeKey, res.commands || []);
            })
            .catch(() => {});
        }
      }

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

  // 当前选中标的专属的信号列表
  const symbolSignals = useMemo(() => {
    return signals.filter((s) => s.securityCode === selectedSymbol);
  }, [signals, selectedSymbol]);

  // 标的买卖点信号与 K 线数组的下标对齐索引
  const signalIndices = useMemo(() => {
    if (!rawK || rawK.length === 0 || !symbolSignals || symbolSignals.length === 0) return [];
    return symbolSignals
      .map((sig) => {
        const sigTime = new Date(sig.signalTime).getTime();
        let idx = rawK.findIndex((item) => new Date(item.time).getTime() === sigTime);
        if (idx < 0) {
          idx = rawK.findIndex((item) => new Date(item.time).getTime() >= sigTime);
        }
        return { signal: sig, index: idx };
      })
      .filter((item) => item.index >= 0)
      .sort((a, b) => a.index - b.index);
  }, [rawK, symbolSignals]);

  // 信号点击聚焦并打开诊断抽屉，同时在回测模式下瞬移游标切入单步复盘
  const handleSelectSignal = (sig: StrategyBacktestSignalResult) => {
    setSelectedSignal(sig);
    if (sig.securityCode !== selectedSymbol && activeRun) {
      void handleSelectSymbol(sig.securityCode);
    }
    if (rawK.length > 0) {
      const sigTime = new Date(sig.signalTime).getTime();
      let targetIdx = rawK.findIndex((k) => new Date(k.time).getTime() === sigTime);
      if (targetIdx < 0) {
        targetIdx = rawK.findIndex((k) => new Date(k.time).getTime() >= sigTime);
      }
      if (targetIdx >= 0) {
        setCursorIndex(targetIdx);
        setIsReplayMode(true);
      }
    }
  };

  // 单步推演交互操作集
  const handleToggleReplayMode = (active: boolean) => {
    setIsReplayMode(active);
    setIsPlaying(false);
    if (active && cursorIndex === 0 && rawK.length > 0) {
      setCursorIndex(rawK.length - 1);
    }
  };

  const handleStepPrev = useCallback(() => {
    setCursorIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const handleStepNext = useCallback(() => {
    setCursorIndex((prev) => Math.min(rawK.length - 1, prev + 1));
  }, [rawK.length]);

  const handleJumpFirst = useCallback(() => {
    setCursorIndex(0);
  }, []);

  const handleJumpLast = useCallback(() => {
    setCursorIndex(Math.max(0, rawK.length - 1));
  }, [rawK.length]);

  const handleJumpPrevSignal = useCallback(() => {
    const prev = [...signalIndices].reverse().find((s) => s.index < cursorIndex);
    if (prev) {
      setCursorIndex(prev.index);
      setSelectedSignal(prev.signal);
    }
  }, [signalIndices, cursorIndex]);

  const handleJumpNextSignal = useCallback(() => {
    const next = signalIndices.find((s) => s.index > cursorIndex);
    if (next) {
      setCursorIndex(next.index);
      setSelectedSignal(next.signal);
    }
  }, [signalIndices, cursorIndex]);

  const handleSeek = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(rawK.length - 1, index));
      setCursorIndex(clamped);
      const matched = signalIndices.find((s) => s.index === clamped);
      if (matched) {
        setSelectedSignal(matched.signal);
      }
    },
    [rawK.length, signalIndices]
  );

  const handleTogglePlay = useCallback(() => {
    if (!isPlaying && cursorIndex >= rawK.length - 1) {
      setCursorIndex(0);
    }
    setIsPlaying((prev) => !prev);
  }, [isPlaying, cursorIndex, rawK.length]);

  // 游标推进时拉取或从缓存获取截至当期时刻的缠论几何图形
  useEffect(() => {
    if (!isReplayMode || !activeRun || !selectedSymbol || rawK.length === 0) {
      return;
    }
    const currentBar = rawK[cursorIndex];
    if (!currentBar) return;

    const toVisualQueryDate = (iso: string | Date | number) =>
      formatShanghaiDateTime(iso).replace(/\//g, "-");
    const timeKey = toVisualQueryDate(currentBar.time);

    if (replayCommandsCache.current.has(timeKey)) {
      setReplayCommands(replayCommandsCache.current.get(timeKey)!);
      return;
    }

    const reqId = ++activeReplayReqId.current;
    const visualStart = toVisualQueryDate(activeRun.startDate);

    fetchVisualCommands({
      code: selectedSymbol,
      period: activeRun.period,
      source: activeRun.source,
      startDate: visualStart,
      endDate: timeKey,
    })
      .then((res) => {
        const cmds = res.commands || [];
        replayCommandsCache.current.set(timeKey, cmds);
        if (activeReplayReqId.current === reqId) {
          setReplayCommands(cmds);
        }
      })
      .catch(() => {});
  }, [isReplayMode, cursorIndex, activeRun, selectedSymbol, rawK]);

  // 自动播放定时推演
  useEffect(() => {
    if (!isPlaying || !isReplayMode) return;
    const timer = setInterval(() => {
      setCursorIndex((prev) => {
        if (prev >= rawK.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        const nextIdx = prev + 1;
        const matched = signalIndices.find((s) => s.index === nextIdx);
        if (matched) {
          setSelectedSignal(matched.signal);
        }
        return nextIdx;
      });
    }, playSpeed);
    return () => clearInterval(timer);
  }, [isPlaying, isReplayMode, rawK.length, playSpeed, signalIndices]);

  // 全局键盘快捷键：[ 或 ← 步退，] 或 → 步进，Space 播放暂停，PageUp/PageDown 切买卖点
  useEffect(() => {
    if (!isReplayMode || rawK.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;

      if (e.key === "[" || e.key === "ArrowLeft") {
        e.preventDefault();
        setCursorIndex((prev) => Math.max(0, prev - 1));
      } else if (e.key === "]" || e.key === "ArrowRight") {
        e.preventDefault();
        setCursorIndex((prev) => Math.min(rawK.length - 1, prev + 1));
      } else if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        handleTogglePlay();
      } else if (e.key === "PageUp") {
        e.preventDefault();
        handleJumpPrevSignal();
      } else if (e.key === "PageDown") {
        e.preventDefault();
        handleJumpNextSignal();
      } else if (e.key === "Home") {
        e.preventDefault();
        setCursorIndex(0);
      } else if (e.key === "End") {
        e.preventDefault();
        setCursorIndex(rawK.length - 1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isReplayMode, rawK.length, handleTogglePlay, handleJumpPrevSignal, handleJumpNextSignal]);

  // 根据当前复盘模式构建最终展示的图表数据与几何指令
  const displayedChart = useMemo(() => {
    if (!rawK || rawK.length === 0) return chart;
    if (!isReplayMode) {
      return {
        symbol: selectedSymbol,
        k: rawK,
        commands: [...fullCommands, ...allSignalCommands],
      };
    }
    const currentBar = rawK[cursorIndex];
    const currentBarTimeMs = currentBar ? new Date(currentBar.time).getTime() : 0;
    const visibleSignalCommands = allSignalCommands.filter((cmd) => {
      return cmd.time ? new Date(cmd.time).getTime() <= currentBarTimeMs : true;
    });
    return {
      symbol: selectedSymbol,
      k: rawK.slice(0, cursorIndex + 1),
      commands: [...replayCommands, ...visibleSignalCommands],
    };
  }, [
    chart,
    isReplayMode,
    selectedSymbol,
    rawK,
    cursorIndex,
    fullCommands,
    allSignalCommands,
    replayCommands,
  ]);

  const symbolSignalCounts = (signals || []).reduce<Record<string, number>>((acc, s) => {
    acc[s.securityCode] = (acc[s.securityCode] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="backtest-page">
      <WorkspaceShell
        storageKey="mist_workspace_sidebar_backtests"
        sidebarTitle={<h1 className="workspace-sidebar-title">回测工作台</h1>}
        sidebarWidth={380}
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
            <div className="backtest-metrics-bar">
              <div className="metrics-bar-left">
                <strong>#{activeRun.id} 回测复盘</strong>
                <span className="info-pill">{selectedSymbol || activeRun.targetUniverse?.[0]}</span>
                <span className="info-pill">{activeRun.period} 分钟</span>
                <span className="info-pill">{activeRun.source.toUpperCase()}</span>
                <span className="info-pill tnum">
                  {formatShanghaiDate(activeRun.startDate)} ~ {formatShanghaiDate(activeRun.endDate)}
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

          {/* 回测单步推演复盘控制栏 */}
          {activeRun && activeRun.status === "completed" && rawK.length > 0 && (
            <BacktestReplayBar
              isReplayMode={isReplayMode}
              onToggleReplayMode={handleToggleReplayMode}
              cursorIndex={cursorIndex}
              totalBars={rawK.length}
              currentBar={rawK[cursorIndex] || null}
              signalIndices={signalIndices}
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
              onChangeSpeed={setPlaySpeed}
              onOpenDiagnosis={() => {
                const activeSig = signalIndices.find((s) => s.index === cursorIndex)?.signal;
                if (activeSig) setSelectedSignal(activeSig);
              }}
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
                focusedSignalTime={
                  isReplayMode
                    ? signalIndices.some((s) => s.index === cursorIndex)
                      ? selectedSignal?.signalTime ?? null
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
            />
          )}
        </section>
      </WorkspaceShell>

      {/* 缠论中枢与背驰下钻诊断抽屉 */}
      <ChanDiagnosisDrawer
        signal={selectedSignal}
        onClose={() => setSelectedSignal(null)}
      />
    </div>
  );
}

export default BacktestWorkspace;
