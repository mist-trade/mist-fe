import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  startSimulation,
  controlSimulation,
  stopSimulation,
  getSimulationStreamUrl,
  isLocalDevEnvironment,
  fetchVisualCommands,
  type StrategyBacktestRun,
  type StrategyBacktestSignalResult,
  type VisualCommandVo,
  type SimulationFrameVo,
  type SimulationSignalVo,
} from "@/app/api/client";
import type { IFetchK } from "@/app/api/types";
import { formatShanghaiDateTime } from "@/app/lib/time";
import {
  toBacktestSignalResult,
  convertReplaySignalsToCommands,
} from "../utils/backtest-signal-visual.util";

interface UseBacktestReplayParams {
  selectedSymbol: string;
  activeRun: StrategyBacktestRun | null;
  rawK: IFetchK[];
  signalIndices: Array<{ signal: StrategyBacktestSignalResult; index: number }>;
  onSelectSignal: (sig: StrategyBacktestSignalResult) => void;
}

export function useBacktestReplay({
  selectedSymbol,
  activeRun,
  rawK,
  signalIndices,
  onSelectSignal,
}: UseBacktestReplayParams) {
  const [isReplayMode, setIsReplayMode] = useState<boolean>(false);
  const [cursorIndex, setCursorIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playSpeed, setPlaySpeed] = useState<number>(250);
  const [replayCommands, setReplayCommands] = useState<VisualCommandVo[]>([]);
  const [replaySignals, setReplaySignals] = useState<SimulationSignalVo[]>([]);
  const [simulationSessionId, setSimulationSessionId] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const isDev = useMemo(() => isLocalDevEnvironment(), []);
  const replayCommandsCache = useRef<Map<string, VisualCommandVo[]>>(new Map());
  const activeReplayReqId = useRef<number>(0);
  const seekDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // 将仿真推流实时到达的 signals 转化为图表 Marker 指令（仅限复盘模式独占使用）
  const replaySignalCommands = useMemo<VisualCommandVo[]>(() => {
    if (!isReplayMode || !replaySignals || replaySignals.length === 0) return [];
    const minTimeMs = rawK.length > 0 ? new Date(rawK[0].time).getTime() : 0;
    return convertReplaySignalsToCommands(replaySignals, minTimeMs);
  }, [isReplayMode, replaySignals, rawK]);

  // 单步推演模式下已触发信号在 K 线序列中的位置索引映射（供推演底栏时间轴刻度展示）
  const replaySignalIndices = useMemo(() => {
    if (!rawK || rawK.length === 0 || !replaySignals || replaySignals.length === 0) return [];
    return replaySignals
      .map((sig, i) => {
        const sigTime = new Date(sig.signalTime).getTime();
        let idx = rawK.findIndex((k) => new Date(k.time).getTime() === sigTime);
        if (idx < 0) {
          idx = rawK.findIndex((k) => new Date(k.time).getTime() >= sigTime);
        }
        return {
          signal: toBacktestSignalResult(sig, i + 1),
          index: Math.max(0, idx),
        };
      })
      .sort((a, b) => a.index - b.index);
  }, [rawK, replaySignals]);

  // 单步推演 / 实时仿真控制操作集 (仅在本地开发环境激活 SSE 仿真引擎，非本地/生产环境走纯前端离线复盘)
  const handleToggleReplayMode = async (active: boolean) => {
    if (active) {
      setIsReplayMode(true);
      setIsPlaying(false);
      // 进入单步复盘模式：必须明确从第 1 根 K 线 (cursor 0) 开始，且处于初始暂停态，严禁自动播放或跳跃到末尾
      setCursorIndex(0);
      setReplayCommands([]);
      setReplaySignals([]);
      if (isDev) {
        try {
          const summary = await startSimulation({
            securityCode: selectedSymbol || "000001",
            period: activeRun?.period || 30,
            startDate: activeRun?.startDate,
            endDate: activeRun?.endDate,
          });
          setSimulationSessionId(summary.sessionId);
        } catch (err: unknown) {
          console.error(
            "启动本地开发仿真失败:",
            err instanceof Error ? err.message : String(err)
          );
        }
      }
    } else {
      setIsReplayMode(false);
      setIsPlaying(false);
      setCursorIndex(Math.max(0, rawK.length - 1));
      if (simulationSessionId) {
        void stopSimulation(simulationSessionId);
        setSimulationSessionId(null);
      }
      setReplayCommands([]);
      setReplaySignals([]);
    }
  };

  const handleStepPrev = useCallback(async () => {
    setIsPlaying(false);
    const prevIdx = Math.max(0, cursorIndex - 1);
    setCursorIndex(prevIdx);
    if (simulationSessionId) {
      try {
        const res = await controlSimulation({ sessionId: simulationSessionId, action: "step_prev" });
        if (res && typeof res.currentCursor === "number" && res.currentCursor >= 0) {
          setCursorIndex(res.currentCursor);
        }
      } catch (err) {
        console.warn("步退同步异常:", err);
      }
    }
  }, [simulationSessionId, cursorIndex]);

  const handleStepNext = useCallback(async () => {
    setIsPlaying(false);
    const nextIdx = Math.min(rawK.length - 1, cursorIndex + 1);
    setCursorIndex(nextIdx);
    if (simulationSessionId) {
      try {
        const res = await controlSimulation({ sessionId: simulationSessionId, action: "step_next" });
        if (res && typeof res.currentCursor === "number" && res.currentCursor >= 0) {
          setCursorIndex(res.currentCursor);
        }
      } catch (err) {
        console.warn("步进同步异常:", err);
      }
    }
  }, [simulationSessionId, rawK.length, cursorIndex]);

  const handleJumpFirst = useCallback(() => {
    setIsPlaying(false);
    setCursorIndex(0);
    if (simulationSessionId) {
      void controlSimulation({ sessionId: simulationSessionId, action: "seek", param: 0 });
    }
  }, [simulationSessionId]);

  const handleJumpLast = useCallback(() => {
    setIsPlaying(false);
    const lastIdx = Math.max(0, rawK.length - 1);
    setCursorIndex(lastIdx);
    if (simulationSessionId) {
      void controlSimulation({ sessionId: simulationSessionId, action: "seek", param: lastIdx });
    }
  }, [simulationSessionId, rawK.length]);

  const handleJumpPrevSignal = useCallback(() => {
    setIsPlaying(false);
    const activeList = signalIndices.length > 0 ? signalIndices : replaySignalIndices;
    const prev = [...activeList].reverse().find((s) => s.index < cursorIndex);
    if (prev) {
      setCursorIndex(prev.index);
      if (simulationSessionId) {
        void controlSimulation({ sessionId: simulationSessionId, action: "seek", param: prev.index });
      }
      onSelectSignal(prev.signal);
    }
  }, [signalIndices, replaySignalIndices, cursorIndex, simulationSessionId, onSelectSignal]);

  const handleJumpNextSignal = useCallback(() => {
    setIsPlaying(false);
    const activeList = signalIndices.length > 0 ? signalIndices : replaySignalIndices;
    const next = activeList.find((s) => s.index > cursorIndex);
    if (next) {
      setCursorIndex(next.index);
      if (simulationSessionId) {
        void controlSimulation({ sessionId: simulationSessionId, action: "seek", param: next.index });
      }
      onSelectSignal(next.signal);
    }
  }, [signalIndices, replaySignalIndices, cursorIndex, simulationSessionId, onSelectSignal]);

  const handleSeek = useCallback(
    (index: number) => {
      setIsPlaying(false);
      const clamped = Math.max(0, Math.min(rawK.length - 1, index));
      setCursorIndex(clamped);
      if (simulationSessionId) {
        if (seekDebounceRef.current) {
          clearTimeout(seekDebounceRef.current);
        }
        seekDebounceRef.current = setTimeout(() => {
          void controlSimulation({ sessionId: simulationSessionId, action: "seek", param: clamped });
        }, 150);
      }
      const activeList = signalIndices.length > 0 ? signalIndices : replaySignalIndices;
      const matched = activeList.find((s) => s.index === clamped);
      if (matched) {
        onSelectSignal(matched.signal);
      }
    },
    [rawK.length, signalIndices, replaySignalIndices, simulationSessionId, onSelectSignal]
  );

  const handleTogglePlay = useCallback(() => {
    const nextPlaying = !isPlaying;
    setIsPlaying(nextPlaying);
    if (simulationSessionId) {
      if (nextPlaying && cursorIndex >= rawK.length - 1) {
        void controlSimulation({
          sessionId: simulationSessionId,
          action: "seek",
          param: 0,
        });
        setCursorIndex(0);
      }
      void controlSimulation({
        sessionId: simulationSessionId,
        action: nextPlaying ? "play" : "pause",
      });
    } else if (nextPlaying && cursorIndex >= rawK.length - 1) {
      setCursorIndex(0);
    }
  }, [isPlaying, simulationSessionId, cursorIndex, rawK.length]);

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

  const onSelectSignalRef = useRef(onSelectSignal);
  useEffect(() => {
    onSelectSignalRef.current = onSelectSignal;
  }, [onSelectSignal]);

  // 仿真推流长连接 (SSE) 声明式生命周期管理
  useEffect(() => {
    if (!simulationSessionId || !isReplayMode) return;

    const streamUrl = getSimulationStreamUrl(simulationSessionId);
    if (!streamUrl) return;

    const es = new EventSource(streamUrl);
    eventSourceRef.current = es;

    es.addEventListener("frame", (event) => {
      try {
        const frame: SimulationFrameVo = JSON.parse(event.data);
        setCursorIndex(frame.cursor);

        // 严格以当前到达的单步 K 线时间为上限，过滤指令流，杜绝残影
        const curBarTimeMs = new Date(frame.bar.time).getTime();
        const cmds = (frame.commands || []).filter((cmd) => {
          const rawTime = cmd.startTime ?? cmd.fromTime ?? cmd.time;
          if (!rawTime) return true;
          const timeMs = new Date(rawTime).getTime();
          if (isNaN(timeMs)) return true;
          if (timeMs > curBarTimeMs) return false;
          return true;
        });
        setReplayCommands(cmds);

        // 仅由 SSE 推流驱动单步复盘信号
        const frameSignals = frame.signals || [];
        setReplaySignals(frameSignals);

        // 若当前到达的 Bar 触发了新信号，自动同步激活选中诊断
        const barTimeMs = new Date(frame.bar.time).getTime();
        const activeSig = frameSignals.find(
          (s) => new Date(s.signalTime).getTime() === barTimeMs
        );
        if (activeSig) {
          onSelectSignalRef.current?.(toBacktestSignalResult(activeSig, frame.cursor));
        }
        if (frame.status === "completed") {
          setIsPlaying(false);
        }
      } catch (err) {
        console.error("解析仿真帧失败:", err);
      }
    });

    es.addEventListener("status", (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.status === "completed" || data.status === "paused" || data.status === "idle") {
          setIsPlaying(false);
        } else if (data.status === "playing") {
          setIsPlaying(true);
        }
      } catch {
        // ignore
      }
    });

    return () => {
      es.close();
      if (eventSourceRef.current === es) {
        eventSourceRef.current = null;
      }
    };
  }, [simulationSessionId, isReplayMode]);

  // 非仿真模式（生产离线复盘）下的自动播放定时器
  useEffect(() => {
    if (!isPlaying || !isReplayMode || simulationSessionId) return;
    const timer = setInterval(() => {
      setCursorIndex((prev) => {
        if (prev >= rawK.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        const nextIdx = prev + 1;
        const matched = signalIndices.find((s) => s.index === nextIdx);
        if (matched) {
          onSelectSignalRef.current?.(matched.signal);
        }
        return nextIdx;
      });
    }, playSpeed);
    return () => clearInterval(timer);
  }, [isPlaying, isReplayMode, rawK.length, playSpeed, signalIndices, simulationSessionId]);

  // 非仿真模式下，随游标推进获取截至当前时刻的纯几何图元
  useEffect(() => {
    if (!isReplayMode || !activeRun || !selectedSymbol || rawK.length === 0 || simulationSessionId) {
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

    setReplayCommands([]);
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
        const cmds = (res.commands || []).filter(
          (cmd) => cmd.layer !== "backtest_signals"
        );
        replayCommandsCache.current.set(timeKey, cmds);
        if (activeReplayReqId.current === reqId) {
          setReplayCommands(cmds);
        }
      })
      .catch(() => {});
  }, [isReplayMode, cursorIndex, activeRun, selectedSymbol, rawK, simulationSessionId]);

  // 组件卸载时释放当前活跃仿真会话资源
  const activeSessionIdRef = useRef<string | null>(null);
  useEffect(() => {
    activeSessionIdRef.current = simulationSessionId;
  }, [simulationSessionId]);

  useEffect(() => {
    return () => {
      if (seekDebounceRef.current) {
        clearTimeout(seekDebounceRef.current);
      }
      if (activeSessionIdRef.current) {
        void stopSimulation(activeSessionIdRef.current);
      }
    };
  }, []);

  // 全局键盘快捷键：[ 或 ← 步退，] 或 → 步进，Space 播放暂停，PageUp/PageDown 切买卖点，Home/End 跳转
  useEffect(() => {
    if (!isReplayMode || rawK.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        (e.target as HTMLElement)?.isContentEditable
      )
        return;

      if (e.key === "[" || e.key === "ArrowLeft") {
        e.preventDefault();
        handleStepPrev();
      } else if (e.key === "]" || e.key === "ArrowRight") {
        e.preventDefault();
        handleStepNext();
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
        handleJumpFirst();
      } else if (e.key === "End") {
        e.preventDefault();
        handleJumpLast();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isReplayMode,
    rawK.length,
    handleStepPrev,
    handleStepNext,
    handleTogglePlay,
    handleJumpPrevSignal,
    handleJumpNextSignal,
    handleJumpFirst,
    handleJumpLast,
  ]);

  const resetReplayState = useCallback(() => {
    setIsReplayMode(false);
    setIsPlaying(false);
    setCursorIndex(0);
    setReplayCommands([]);
    setReplaySignals([]);
    if (simulationSessionId) {
      void stopSimulation(simulationSessionId);
      setSimulationSessionId(null);
    }
  }, [simulationSessionId]);

  return {
    isReplayMode,
    setIsReplayMode,
    cursorIndex,
    setCursorIndex,
    isPlaying,
    playSpeed,
    replayCommands,
    setReplayCommands,
    replaySignals,
    setReplaySignals,
    simulationSessionId,
    setSimulationSessionId,
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
  };
}
