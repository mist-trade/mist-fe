"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  listStrategies,
  listStrategyVersions,
  fetchStrategyBacktestRun,
  listStrategyBacktestRuns,
  fetchStrategyBacktestSignals,
  createStrategyBacktest,
  fetchK,
  fetchVisualCommands,
  startSimulation,
  controlSimulation,
  stopSimulation,
  getSimulationStreamUrl,
  fetchSimulationDump,
  type StrategyDefinition,
  type StrategyVersion,
  type StrategyBacktestRun,
  type StrategyBacktestSignalResult,
  type VisualCommandVo,
  type SimulationFrameVo,
} from "@/app/api/client";
import type { IFetchK } from "@/app/api/types";
import { BacktestConfigPanel, type BacktestConfigValues } from "./components/BacktestConfigPanel";
import { BacktestRunHistory } from "./components/BacktestRunHistory";
import { BacktestSignalTable } from "./components/BacktestSignalTable";
import { DecisionTraceDrawer } from "@/app/components/DecisionTraceDrawer";
import { BacktestReplayBar } from "./components/BacktestReplayBar";
import { WorkspaceShell } from "@/app/components/layout/WorkspaceShell";
import { formatShanghaiDate, formatShanghaiDateTime } from "@/app/lib/time";

import TradingViewChart from "@/app/components/tv-chart/TradingViewChart";

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

  // 缠论图层与买卖点显示控制（默认只展示笔折线、笔中枢与回测买卖点；默认隐藏段中枢与原生买卖点）
  const [showBi, setShowBi] = useState<boolean>(true);
  const [showBiZs, setShowBiZs] = useState<boolean>(true);
  const [showDuan, setShowDuan] = useState<boolean>(false);
  const [showDuanZs, setShowDuanZs] = useState<boolean>(false);
  const [showBacktestSignals, setShowBacktestSignals] = useState<boolean>(true);
  const [showChanBsp, setShowChanBsp] = useState<boolean>(false);

  // 按用户选中的图层开关过滤绘图指令集合
  const filterCommandsByLayers = useCallback(
    (cmds: VisualCommandVo[]) => {
      return cmds.filter((cmd) => {
        if (cmd.layer === "chan_bi") return showBi;
        if (cmd.layer === "chan_zs_bi") return showBiZs;
        if (cmd.layer === "chan_duan") return showDuan;
        if (cmd.layer === "chan_zs_duan") return showDuanZs;
        if (cmd.layer === "chan_bsp") return showChanBsp;
        if (cmd.layer === "backtest_signals") return showBacktestSignals;
        return true;
      });
    },
    [showBi, showBiZs, showDuan, showDuanZs, showChanBsp, showBacktestSignals]
  );

  // 全量原始走势与全局指令
  const [rawK, setRawK] = useState<IFetchK[]>([]);
  const [fullCommands, setFullCommands] = useState<VisualCommandVo[]>([]);
  const [allSignalCommands, setAllSignalCommands] = useState<VisualCommandVo[]>([]);

  // 实时流式推演仿真控制状态 (SSE)
  const [isReplayMode, setIsReplayMode] = useState<boolean>(false);
  const [cursorIndex, setCursorIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playSpeed, setPlaySpeed] = useState<number>(500);
  const [replayCommands, setReplayCommands] = useState<VisualCommandVo[]>([]);
  const [simulationSessionId, setSimulationSessionId] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

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
        const chanBsp = (ctx.chanBsp || {}) as Record<string, unknown>;
        const trace = (sig.decisionTrace || {}) as Record<string, unknown>;

        const rawType = String(
          sig.signalType ||
          chanBsp.type ||
          ctx.type ||
          "signal"
        );
        const isSell =
          rawType.includes("sell") ||
          rawType === "exit" ||
          ctx.action === "SELL" ||
          trace.action === "SELL";

        let label = isSell ? "卖点" : "买点";
        if (rawType === "first_buy") label = "1买";
        else if (rawType === "first_sell") label = "1卖";
        else if (rawType === "second_buy") label = "2买";
        else if (rawType === "second_sell") label = "2卖";
        else if (rawType === "third_buy") label = "3买";
        else if (rawType === "third_sell") label = "3卖";
        else if (ctx.signalTag && typeof ctx.signalTag === "string") label = ctx.signalTag;
        else if (trace.signalTag && typeof trace.signalTag === "string") label = trace.signalTag;

        const rawPrice = ctx.triggerPrice ?? trace.price ?? ctx.price;
        const price =
          typeof rawPrice === "number" && Number.isFinite(rawPrice)
            ? rawPrice
            : undefined;

        return {
          id: `backtest_sig_${sig.id}`,
          type: "text",
          layer: "backtest_signals",
          time: sig.signalTime,
          price,
          text: label,
          position: isSell ? "above" : "below",
          color: isSell ? "#22C55E" : "#EF4444",
        };
      });

      // 过滤掉视觉服务底图中可能携带的静态 backtest_signals，避免与动态回测信号双重叠加
      const pureVisualCommands = (visualPayload.commands || []).filter(
        (cmd) => cmd.layer !== "backtest_signals"
      );
      const mergedCommands = [...pureVisualCommands, ...signalCommands];

      setRawK(kLines);
      setFullCommands(pureVisualCommands);
      setAllSignalCommands(signalCommands);
      setCursorIndex(Math.max(0, kLines.length - 1));
      setReplayCommands(pureVisualCommands);
      setIsPlaying(false);

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

  // 信号点击聚焦并打开诊断抽屉，同时在回测模式下瞬移游标切入单步复盘
  const handleSelectSignal = (sig: StrategyBacktestSignalResult) => {
    setSelectedSignal(sig);
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
          setCursorIndex(targetIdx);
          setIsReplayMode(true);
        }
      }
    }
  };

  // 单步推演 / 实时仿真控制操作集 (SSE 长连接驱动)
  const handleToggleReplayMode = async (active: boolean) => {
    if (active) {
      setIsReplayMode(true);
      setIsPlaying(false);
      try {
        const summary = await startSimulation({
          securityCode: selectedSymbol || "000001",
          period: activeRun?.period || 30,
          startDate: activeRun?.startDate,
          endDate: activeRun?.endDate,
        });
        setSimulationSessionId(summary.sessionId);

        if (eventSourceRef.current) {
          eventSourceRef.current.close();
        }
        const es = new EventSource(getSimulationStreamUrl(summary.sessionId));
        eventSourceRef.current = es;

        es.addEventListener("frame", (event) => {
          try {
            const frame: SimulationFrameVo = JSON.parse(event.data);
            setCursorIndex(frame.cursor);
            const cmds = (frame.commands || []).filter(
              (cmd) => cmd.layer !== "backtest_signals"
            );
            setReplayCommands(cmds);
          } catch {
            // ignore JSON parse error
          }
        });

        es.addEventListener("status", (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.status === "completed") {
              setIsPlaying(false);
            }
          } catch {
            // ignore
          }
        });
      } catch (err: unknown) {
        console.error("启动仿真失败:", err instanceof Error ? err.message : String(err));
      }
    } else {
      setIsReplayMode(false);
      setIsPlaying(false);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (simulationSessionId) {
        void stopSimulation(simulationSessionId);
        setSimulationSessionId(null);
      }
    }
  };

  const handleStepPrev = useCallback(() => {
    if (simulationSessionId) {
      void controlSimulation({ sessionId: simulationSessionId, action: "step_prev" });
    } else {
      setCursorIndex((prev) => Math.max(0, prev - 1));
    }
  }, [simulationSessionId]);

  const handleStepNext = useCallback(() => {
    if (simulationSessionId) {
      void controlSimulation({ sessionId: simulationSessionId, action: "step_next" });
    } else {
      setCursorIndex((prev) => Math.min(rawK.length - 1, prev + 1));
    }
  }, [simulationSessionId, rawK.length]);

  const handleJumpFirst = useCallback(() => {
    if (simulationSessionId) {
      void controlSimulation({ sessionId: simulationSessionId, action: "seek", param: 0 });
    } else {
      setCursorIndex(0);
    }
  }, [simulationSessionId]);

  const handleJumpLast = useCallback(() => {
    const lastIdx = Math.max(0, rawK.length - 1);
    if (simulationSessionId) {
      void controlSimulation({ sessionId: simulationSessionId, action: "seek", param: lastIdx });
    } else {
      setCursorIndex(lastIdx);
    }
  }, [simulationSessionId, rawK.length]);

  const handleJumpPrevSignal = useCallback(() => {
    const prev = [...signalIndices].reverse().find((s) => s.index < cursorIndex);
    if (prev) {
      if (simulationSessionId) {
        void controlSimulation({ sessionId: simulationSessionId, action: "seek", param: prev.index });
      }
      setCursorIndex(prev.index);
      setSelectedSignal(prev.signal);
    }
  }, [signalIndices, cursorIndex, simulationSessionId]);

  const handleJumpNextSignal = useCallback(() => {
    const next = signalIndices.find((s) => s.index > cursorIndex);
    if (next) {
      if (simulationSessionId) {
        void controlSimulation({ sessionId: simulationSessionId, action: "seek", param: next.index });
      }
      setCursorIndex(next.index);
      setSelectedSignal(next.signal);
    }
  }, [signalIndices, cursorIndex, simulationSessionId]);

  const handleSeek = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(rawK.length - 1, index));
      setCursorIndex(clamped);
      if (simulationSessionId) {
        void controlSimulation({ sessionId: simulationSessionId, action: "seek", param: clamped });
      }
      const matched = signalIndices.find((s) => s.index === clamped);
      if (matched) {
        setSelectedSignal(matched.signal);
      }
    },
    [rawK.length, signalIndices, simulationSessionId]
  );

  const handleTogglePlay = useCallback(() => {
    const nextPlaying = !isPlaying;
    setIsPlaying(nextPlaying);
    if (simulationSessionId) {
      void controlSimulation({
        sessionId: simulationSessionId,
        action: nextPlaying ? "play" : "pause",
      });
    }
  }, [isPlaying, simulationSessionId]);

  const handleChangeSpeed = useCallback(
    (speed: number) => {
      setPlaySpeed(speed);
      if (simulationSessionId) {
        void controlSimulation({
          sessionId: simulationSessionId,
          action: "set_speed",
          param: speed,
        });
      }
    },
    [simulationSessionId]
  );

  // 导出当前推演仿真的状态快照（队列数据、OHLCV、图元指令与决策树信号）
  const handleDumpSimulationState = useCallback(async () => {
    try {
      setStatusMessage("正在提取当前仿真状态快照…");
      const dump = await fetchSimulationDump(simulationSessionId || undefined);
      const jsonStr = JSON.stringify(dump, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const sym = selectedSymbol || "universe";
      const cur = dump.cursor;
      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      a.href = url;
      a.download = `sim-dump-${sym}-bar${cur}-${ts}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatusMessage(
        `已导出仿真诊断快照 (游标: ${cur + 1}/${dump.totalBars}, 队列: ${dump.queueSize} 条, 图元: ${dump.renderData?.commandsCount || 0} 个, 信号: ${dump.signalsCount || 0} 个)`
      );
      setTimeout(() => setStatusMessage(""), 5000);
    } catch (err) {
      setLoadError("导出仿真快照失败: " + (err instanceof Error ? err.message : String(err)));
      setStatusMessage("");
    }
  }, [simulationSessionId, selectedSymbol]);

  // 页面卸载或标的切换时清理 SSE 连接
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (simulationSessionId) {
        void stopSimulation(simulationSessionId);
      }
    };
  }, [simulationSessionId]);

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

  // 根据当前复盘模式与图层开关构建最终展示的图表数据与几何指令
  const displayedChart = useMemo(() => {
    if (!rawK || rawK.length === 0) return chart;
    if (!isReplayMode) {
      const all = [...fullCommands, ...allSignalCommands];
      return {
        symbol: selectedSymbol,
        k: rawK,
        commands: filterCommandsByLayers(all),
      };
    }
    const currentBar = rawK[cursorIndex];
    const currentBarTimeMs = currentBar ? new Date(currentBar.time).getTime() : 0;
    const visibleSignalCommands = allSignalCommands.filter((cmd) => {
      if (!cmd.time) return false;
      const cmdTimeMs = new Date(cmd.time).getTime();
      return cmdTimeMs <= currentBarTimeMs;
    });

    const all = [...replayCommands, ...visibleSignalCommands];
    return {
      symbol: selectedSymbol,
      k: rawK.slice(0, cursorIndex + 1),
      commands: filterCommandsByLayers(all),
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
    filterCommandsByLayers,
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

          {/* 图层展示控制栏 */}
          {activeRun && rawK.length > 0 && (
            <div className="backtest-layer-controls" role="toolbar" aria-label="图层显示控制">
              <div className="layer-controls-left">
                <span className="layer-controls-title">📐 图层展示:</span>
                <div className="layer-toggles-group">
                  <button
                    type="button"
                    className={`layer-toggle-chip ${showBi ? "active" : ""}`}
                    onClick={() => setShowBi(!showBi)}
                    title="笔折线 (Chan Bi)"
                  >
                    <span className="dot" style={{ background: "#FACC15" }} />
                    笔折线
                  </button>

                  <button
                    type="button"
                    className={`layer-toggle-chip ${showBiZs ? "active" : ""}`}
                    onClick={() => setShowBiZs(!showBiZs)}
                    title="笔中枢 (Bi Central)"
                  >
                    <span
                      className="box-icon"
                      style={{ borderColor: "#38BDF8", background: "rgba(56, 189, 248, 0.25)" }}
                    />
                    笔中枢
                  </button>

                  <button
                    type="button"
                    className={`layer-toggle-chip ${showDuan ? "active" : ""}`}
                    onClick={() => setShowDuan(!showDuan)}
                    title="线段 (Chan Duan)"
                  >
                    <span className="dot" style={{ background: "#818CF8" }} />
                    线段
                  </button>

                  <button
                    type="button"
                    className={`layer-toggle-chip ${showDuanZs ? "active" : ""}`}
                    onClick={() => setShowDuanZs(!showDuanZs)}
                    title="段中枢 (Duan Central)"
                  >
                    <span
                      className="box-icon"
                      style={{ borderColor: "#818CF8", background: "rgba(129, 140, 248, 0.25)" }}
                    />
                    段中枢
                  </button>

                  <button
                    type="button"
                    className={`layer-toggle-chip ${showBacktestSignals ? "active" : ""}`}
                    onClick={() => setShowBacktestSignals(!showBacktestSignals)}
                    title="回测策略买卖点标记 (Backtest Signals)"
                  >
                    <span>🎯</span>
                    回测买卖点
                  </button>

                  <button
                    type="button"
                    className={`layer-toggle-chip ${showChanBsp ? "active" : ""}`}
                    onClick={() => setShowChanBsp(!showChanBsp)}
                    title="缠论指标原生买卖点 (Raw Chan BSP)"
                  >
                    <span>⚡</span>
                    原生买卖点
                  </button>
                </div>
              </div>
            </div>
          )}

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
              onChangeSpeed={handleChangeSpeed}
              onOpenDiagnosis={() => {
                const activeSig = signalIndices.find((s) => s.index === cursorIndex)?.signal;
                if (activeSig) setSelectedSignal(activeSig);
              }}
              onDumpState={handleDumpSimulationState}
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
              onOpenLiveKLine={(code, time) => {
                window.open(`/k?code=${code}&focusTime=${encodeURIComponent(time)}`, '_blank');
              }}
            />
          )}
        </section>
      </WorkspaceShell>

      {/* 白盒决策归因与轨迹诊断抽屉 */}
      <DecisionTraceDrawer
        signal={selectedSignal}
        onClose={() => setSelectedSignal(null)}
        onOpenLiveKLine={(code, time) => {
          window.open(`/k?code=${code}&focusTime=${encodeURIComponent(time)}`, '_blank');
        }}
      />
    </div>
  );
}

export default BacktestWorkspace;
