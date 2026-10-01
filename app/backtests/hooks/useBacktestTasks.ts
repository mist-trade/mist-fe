import { useEffect, useState } from "react";
import {
  listStrategies,
  listStrategyVersions,
  fetchStrategyBacktestRun,
  listStrategyBacktestRuns,
  createStrategyBacktest,
  type StrategyDefinition,
  type StrategyVersion,
  type StrategyBacktestRun,
} from "@/app/api/client";
import type { BacktestConfigValues } from "../components/BacktestConfigPanel";

interface UseBacktestTasksOptions {
  onInitialRunLoaded?: (run: StrategyBacktestRun, firstSymbol: string) => Promise<void> | void;
}

export function useBacktestTasks(options?: UseBacktestTasksOptions) {
  const [strategies, setStrategies] = useState<StrategyDefinition[]>([]);
  const [selectedStrategyId, setSelectedStrategyId] = useState<number | null>(null);
  const [versions, setVersions] = useState<StrategyVersion[]>([]);
  const [runs, setRuns] = useState<StrategyBacktestRun[]>([]);
  const [activeRun, setActiveRun] = useState<StrategyBacktestRun | null>(null);

  const [isRunning, setIsRunning] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [loadError, setLoadError] = useState("");

  // 1. 初始化拉取策略列表、版本与历史回测记录
  useEffect(() => {
    let cancelled = false;

    async function initWorkspace() {
      try {
        const stratPromise =
          typeof listStrategies === "function"
            ? listStrategies().catch(() => [])
            : Promise.resolve([]);
        const runPromise =
          typeof listStrategyBacktestRuns === "function"
            ? listStrategyBacktestRuns().catch(() => [])
            : Promise.resolve([]);

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
            if (options?.onInitialRunLoaded) {
              void options.onInitialRunLoaded(firstCompleted, firstSymbol);
            }
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

  // 3. 轮询回测执行状态
  const pollRunUntilComplete = (
    runId: number,
    onCompleted?: (run: StrategyBacktestRun, firstSymbol: string) => Promise<void> | void
  ) => {
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
            if (onCompleted) {
              await onCompleted(current, firstSym);
            }
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

  // 4. 提交并发起新的回测任务
  const handleStartBacktest = async (
    values: BacktestConfigValues,
    onCompleted?: (run: StrategyBacktestRun, firstSymbol: string) => Promise<void> | void
  ) => {
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
      pollRunUntilComplete(runId, onCompleted);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
      setStatusMessage("");
    }
  };

  return {
    strategies,
    selectedStrategyId,
    versions,
    runs,
    setRuns,
    activeRun,
    setActiveRun,
    isRunning,
    setIsRunning,
    statusMessage,
    setStatusMessage,
    loadError,
    setLoadError,
    handleSelectStrategyId,
    handleStartBacktest,
    pollRunUntilComplete,
  };
}
