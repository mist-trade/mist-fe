"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  acknowledgeStrategyAlertEvent,
  cancelStrategyBacktest,
  createStrategyBacktest,
  createStrategyDefinition,
  disableStrategyDefinition,
  enableStrategyDefinition,
  fetchStrategyAlertEvents,
  fetchStrategyBacktestEquity,
  fetchStrategyBacktestOrders,
  fetchStrategyBacktestSignals,
  fetchStrategyBacktestPositions,
  fetchStrategyBacktestRun,
  fetchStrategyBacktestTrades,
  fetchStrategySignals,
  listStrategies,
  listStrategyBacktests,
  listStrategyVersions,
  runStrategyScan,
  updateStrategyDefinition,
  type BacktestRunStatus,
  type DataSourceValue,
  type StrategyAlertEvent,
  type StrategyBacktestRun,
  type StrategyBacktestSignal,
  type StrategyBacktestEquityPoint,
  type StrategyBacktestOrder,
  type StrategyBacktestTrade,
  type StrategyDefinition,
  type StrategySignal,
  type StrategyVersion,
} from "@/app/api/client";

type StrategyTab = "registry" | "signals" | "alerts" | "backtests";
type BacktestDetailTab =
  | "trades"
  | "orders"
  | "signals"
  | "positions"
  | "snapshot"
  | "error";

const DEFAULT_RULE = {
  field: "k.close",
  operator: "gt",
  value: 100,
};

const formatJson = (value: unknown) => JSON.stringify(value ?? {}, null, 2);

const parseCsv = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const parseNumberCsv = (value: string) =>
  parseCsv(value)
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item));

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  return value.replace("T", " ").replace(".000Z", "");
};

const statusLabel = (status?: string) => status || "-";

const formatMetric = (value: number | null | undefined, suffix = "") =>
  value === null || value === undefined ? "-" : `${value.toFixed(2)}${suffix}`;

const formatPercentMetric = (value: number | null | undefined) =>
  value === null || value === undefined ? "-" : formatMetric(value * 100, "%");

const mergeById = <T extends { id: number }>(items: T[], nextItems: T[]) => [
  ...items,
  ...nextItems.filter((nextItem) => !items.some((item) => item.id === nextItem.id)),
];

function BacktestEquityChart({ points }: { points: StrategyBacktestEquityPoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || points.length === 0) return;

    let active = true;
    let chart: {
      setOption: (option: unknown) => void;
      resize: () => void;
      dispose: () => void;
    } | null = null;
    const resize = () => chart?.resize();
    void Promise.all([
      import("echarts/core"),
      import("echarts/charts"),
      import("echarts/components"),
      import("echarts/renderers"),
    ]).then(([echarts, charts, components, renderers]) => {
      if (!active) return;
      echarts.use([
        charts.LineChart,
        components.GridComponent,
        components.LegendComponent,
        components.TooltipComponent,
        renderers.CanvasRenderer,
      ]);
      chart = echarts.init(container);
      chart.setOption({
        animation: false,
        tooltip: { trigger: "axis" },
        legend: { data: ["组合净值", "基准净值", "回撤"] },
        grid: { top: 36, right: 24, bottom: 28, left: 58 },
        xAxis: {
          type: "category",
          data: points.map((point) => formatDateTime(point.pointTime).slice(0, 10)),
        },
        yAxis: [{ type: "value" }, { type: "value", min: -1, max: 0 }],
        series: [
          {
            name: "组合净值",
            type: "line",
            showSymbol: false,
            data: points.map((point) => point.equity),
          },
          {
            name: "基准净值",
            type: "line",
            showSymbol: false,
            data: points.map((point) => point.benchmarkValue),
          },
          {
            name: "回撤",
            type: "line",
            showSymbol: false,
            yAxisIndex: 1,
            data: points.map((point) => point.drawdown),
          },
        ],
      });
      window.addEventListener("resize", resize);
    });

    return () => {
      active = false;
      window.removeEventListener("resize", resize);
      chart?.dispose();
    };
  }, [points]);

  if (points.length === 0) {
    return <p className="strategy-muted">净值数据将在回测开始后出现。</p>;
  }

  return <div className="backtest-chart" ref={containerRef} aria-label="收益曲线" />;
}

export default function StrategiesWorkspace() {
  const [activeTab, setActiveTab] = useState<StrategyTab>("registry");
  const [strategies, setStrategies] = useState<StrategyDefinition[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [versions, setVersions] = useState<StrategyVersion[]>([]);
  const [signals, setSignals] = useState<StrategySignal[]>([]);
  const [alerts, setAlerts] = useState<StrategyAlertEvent[]>([]);
  const [backtestRuns, setBacktestRuns] = useState<StrategyBacktestRun[]>([]);
  const [backtestRunsNextCursor, setBacktestRunsNextCursor] = useState<string | null>(null);
  const [backtestStatusFilter, setBacktestStatusFilter] = useState<BacktestRunStatus | "">("");
  const [selectedBacktestId, setSelectedBacktestId] = useState<number | null>(null);
  const [backtestRun, setBacktestRun] = useState<StrategyBacktestRun | null>(null);
  const [backtestSignals, setBacktestSignals] = useState<StrategyBacktestSignal[]>([]);
  const [backtestSignalsNextCursor, setBacktestSignalsNextCursor] = useState<string | null>(null);
  const [backtestOrders, setBacktestOrders] = useState<StrategyBacktestOrder[]>([]);
  const [backtestOrdersNextCursor, setBacktestOrdersNextCursor] = useState<string | null>(null);
  const [backtestTrades, setBacktestTrades] = useState<StrategyBacktestTrade[]>([]);
  const [backtestTradesNextCursor, setBacktestTradesNextCursor] = useState<string | null>(null);
  const [backtestEquity, setBacktestEquity] = useState<StrategyBacktestEquityPoint[]>([]);
  const [backtestPositions, setBacktestPositions] = useState<StrategyBacktestTrade[]>([]);
  const [backtestPositionsNextCursor, setBacktestPositionsNextCursor] = useState<string | null>(null);
  const [positionAsOf, setPositionAsOf] = useState("");
  const [backtestDetailTab, setBacktestDetailTab] = useState<BacktestDetailTab>("trades");
  const [isBacktestDrawerOpen, setIsBacktestDrawerOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isActionRunning, setIsActionRunning] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [backtestCreateError, setBacktestCreateError] = useState("");
  const [backtestResultError, setBacktestResultError] = useState("");
  const [editorError, setEditorError] = useState("");
  const [scanResult, setScanResult] = useState("");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [targetUniverse, setTargetUniverse] = useState("");
  const [periods, setPeriods] = useState("1440");
  const [sources, setSources] = useState("tdx");
  const [entryRuleText, setEntryRuleText] = useState(formatJson(DEFAULT_RULE));
  const [exitRuleText, setExitRuleText] = useState(
    formatJson({ field: "k.close", operator: "lt", value: 90 })
  );
  const [lookbackBars, setLookbackBars] = useState("1");
  const [backtestEnabled, setBacktestEnabled] = useState(false);

  const [backtestVersionId, setBacktestVersionId] = useState("");
  const [backtestUniverse, setBacktestUniverse] = useState("");
  const [backtestPeriod, setBacktestPeriod] = useState("1440");
  const [backtestSource, setBacktestSource] = useState<DataSourceValue>("tdx");
  const [backtestStartDate, setBacktestStartDate] = useState("");
  const [backtestEndDate, setBacktestEndDate] = useState("");
  const [backtestInitialCash, setBacktestInitialCash] = useState("1000000");
  const [backtestMaxPositions, setBacktestMaxPositions] = useState("10");
  const [backtestSlippageBps, setBacktestSlippageBps] = useState("5");
  const [backtestCommissionRate, setBacktestCommissionRate] = useState("0.0003");
  const [backtestMinCommission, setBacktestMinCommission] = useState("5");
  const [backtestStampDutyRate, setBacktestStampDutyRate] = useState("0.0005");
  const [backtestTransferFeeRate, setBacktestTransferFeeRate] = useState("0.00001");
  const [backtestBenchmarkCode, setBacktestBenchmarkCode] = useState("000300");

  const selectedStrategy = useMemo(
    () => strategies.find((item) => item.id === selectedId) || null,
    [selectedId, strategies]
  );

  const currentVersion = useMemo(
    () =>
      versions.find((item) => item.id === selectedStrategy?.currentVersionId) ||
      versions[0] ||
      null,
    [selectedStrategy?.currentVersionId, versions]
  );

  const backtestEligibilityReason = useMemo(() => {
    if (!selectedStrategy) return "请先选择一个策略定义。";
    if (!selectedStrategy.backtestEnabled) {
      return "该策略尚未开启回测资格，请先在策略编辑器中开启回测开关。";
    }
    if (!currentVersion?.exitRule) {
      return "当前版本缺少出场规则，不能创建组合回测。";
    }
    if (!selectedStrategy.periods.includes(1440)) {
      return "组合回测仅支持日线周期。";
    }
    if (selectedStrategy.sources.length === 0) {
      return "策略至少需要配置一个数据来源。";
    }
    return "";
  }, [currentVersion?.exitRule, selectedStrategy]);

  const editorBacktestGuidance = useMemo(() => {
    if (!backtestEnabled) return "关闭时可保留空的出场规则，仅用于实时入场信号。";
    if (exitRuleText.trim() === "") return "开启回测前必须填写出场规则 JSON。";
    if (!parseNumberCsv(periods).includes(1440)) return "开启回测时必须包含日线周期 1440。";
    if (parseCsv(sources).length === 0) return "开启回测时至少需要一个数据来源。";
    return "回测资格会由后端再次校验规则字段和历史数据。";
  }, [backtestEnabled, exitRuleText, periods, sources]);

  const refreshStrategies = async () => {
    const items = await listStrategies();
    setStrategies(items);
    setSelectedId((current) => current ?? items[0]?.id ?? null);
    return items;
  };

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    Promise.all([
      refreshStrategies(),
      fetchStrategySignals(),
      fetchStrategyAlertEvents(),
    ])
      .then(([, signalItems, alertItems]) => {
        if (!active) return;
        setSignals(signalItems);
        setAlerts(alertItems);
        setLoadError("");
      })
      .catch((error) => {
        if (!active) return;
        setLoadError(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setVersions([]);
      return;
    }

    let active = true;
    listStrategyVersions(selectedId)
      .then((items) => {
        if (!active) return;
        setVersions(items);
      })
      .catch((error) => {
        if (!active) return;
        setLoadError(error instanceof Error ? error.message : String(error));
      });
    return () => {
      active = false;
    };
  }, [selectedId]);

  useEffect(() => {
    if (!selectedStrategy) return;
    setName(selectedStrategy.name);
    setDescription(selectedStrategy.description || "");
    setTargetUniverse(selectedStrategy.targetUniverse.join(", "));
    setPeriods(selectedStrategy.periods.join(", "));
    setSources(selectedStrategy.sources.join(", "));
    setBacktestVersionId(String(selectedStrategy.currentVersionId || ""));
    setBacktestUniverse(selectedStrategy.targetUniverse.join(", "));
    setBacktestEnabled(Boolean(selectedStrategy.backtestEnabled));
  }, [selectedStrategy]);

  useEffect(() => {
    if (!currentVersion) return;
    setEntryRuleText(formatJson(currentVersion.entryRule));
    setExitRuleText(currentVersion.exitRule ? formatJson(currentVersion.exitRule) : "");
    setLookbackBars(String(currentVersion.lookbackBars));
  }, [currentVersion]);

  const parseRule = (value: string, label: string) => {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      throw new Error(`${label} JSON 格式错误`);
    }
  };

  const parseEditorRules = () => {
    const entryRule = parseRule(entryRuleText, "入场规则");
    const trimmedExitRule = exitRuleText.trim();
    if (trimmedExitRule === "") {
      if (backtestEnabled) {
        throw new Error("开启回测前需填写出场规则 JSON");
      }
      return { entryRule, exitRule: null };
    }

    return {
      entryRule,
      exitRule: parseRule(trimmedExitRule, "出场规则"),
    };
  };

  const parseLookbackBars = () => {
    const value = Number(lookbackBars);
    if (!Number.isInteger(value) || value < 1 || value > 250) {
      throw new Error("Lookback K 线数必须是 1 到 250 的整数");
    }
    return value;
  };

  const saveStrategy = async () => {
    setEditorError("");
    let entryRule: Record<string, unknown>;
    let exitRule: Record<string, unknown> | null;
    let editorLookbackBars: number;
    try {
      ({ entryRule, exitRule } = parseEditorRules());
      editorLookbackBars = parseLookbackBars();
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : String(error));
      return;
    }

    setIsSaving(true);
    try {
      await createStrategyDefinition({
        name,
        description,
        targetUniverse: parseCsv(targetUniverse),
        periods: parseNumberCsv(periods),
        sources: parseCsv(sources) as DataSourceValue[],
        entryRule,
        exitRule,
        lookbackBars: editorLookbackBars,
        backtestEnabled,
      });
      await refreshStrategies();
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSaving(false);
    }
  };

  const updateCurrentStrategy = async () => {
    if (!selectedStrategy) return;
    setEditorError("");
    let entryRule: Record<string, unknown>;
    let exitRule: Record<string, unknown> | null;
    let editorLookbackBars: number;
    try {
      ({ entryRule, exitRule } = parseEditorRules());
      editorLookbackBars = parseLookbackBars();
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : String(error));
      return;
    }

    setIsSaving(true);
    try {
      await updateStrategyDefinition(selectedStrategy.id, {
        name,
        description,
        targetUniverse: parseCsv(targetUniverse),
        periods: parseNumberCsv(periods),
        sources: parseCsv(sources) as DataSourceValue[],
        entryRule,
        exitRule,
        lookbackBars: editorLookbackBars,
        backtestEnabled,
      });
      await refreshStrategies();
      setVersions(await listStrategyVersions(selectedStrategy.id));
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSaving(false);
    }
  };

  const setLifecycle = async (action: "enable" | "disable") => {
    if (!selectedStrategy) return;
    setIsActionRunning(true);
    try {
      if (action === "enable") {
        await enableStrategyDefinition(selectedStrategy.id);
      } else {
        await disableStrategyDefinition(selectedStrategy.id);
      }
      await refreshStrategies();
    } finally {
      setIsActionRunning(false);
    }
  };

  const acknowledgeAlert = async (id: number) => {
    setIsActionRunning(true);
    try {
      const updated = await acknowledgeStrategyAlertEvent(id);
      setAlerts((items) => items.map((item) => (item.id === id ? updated : item)));
    } finally {
      setIsActionRunning(false);
    }
  };

  const runScan = async () => {
    setIsActionRunning(true);
    try {
      const result = await runStrategyScan({
        strategyDefinitionId: selectedStrategy?.id,
        period: selectedStrategy?.periods[0],
        source: selectedStrategy?.sources[0],
      });
      setScanResult(
        `新增信号 ${result.createdSignalCount ?? 0} / 新增告警 ${
          result.createdAlertCount ?? 0
        } / 跳过重复 ${result.skippedDuplicateCount ?? 0}`
      );
      setSignals(await fetchStrategySignals());
      setAlerts(await fetchStrategyAlertEvents());
    } finally {
      setIsActionRunning(false);
    }
  };

  const refreshBacktests = useCallback(async () => {
    const page = await listStrategyBacktests({
      strategyDefinitionId: selectedStrategy?.id,
      status: backtestStatusFilter || undefined,
      limit: 50,
    });
    setBacktestRuns(page.items);
    setBacktestRunsNextCursor(page.nextCursor);
    setSelectedBacktestId((current) =>
      page.items.some((item) => item.id === current) ? current : page.items[0]?.id ?? null
    );
    return page.items;
  }, [backtestStatusFilter, selectedStrategy?.id]);

  const loadBacktestFactPage = async (
    runId: number,
    tab: BacktestDetailTab,
    options: {
      append?: boolean;
      asOf?: string;
      cursor?: string;
    } = {},
    canUpdate: () => boolean = () => true
  ) => {
    if (tab === "snapshot" || tab === "error") return;

    if (tab === "signals") {
      const page = await fetchStrategyBacktestSignals(runId, {
        cursor: options.cursor,
        limit: 100,
      });
      if (!canUpdate()) return;
      setBacktestResultError("");
      setBacktestSignals((items) =>
        options.append ? mergeById(items, page.items) : page.items
      );
      setBacktestSignalsNextCursor(page.nextCursor);
      return;
    }

    if (tab === "orders") {
      const page = await fetchStrategyBacktestOrders(runId, {
        cursor: options.cursor,
        limit: 100,
      });
      if (!canUpdate()) return;
      setBacktestResultError("");
      setBacktestOrders((items) =>
        options.append ? mergeById(items, page.items) : page.items
      );
      setBacktestOrdersNextCursor(page.nextCursor);
      return;
    }

    if (tab === "trades") {
      const page = await fetchStrategyBacktestTrades(runId, {
        cursor: options.cursor,
        limit: 100,
      });
      if (!canUpdate()) return;
      setBacktestResultError("");
      setBacktestTrades((items) =>
        options.append ? mergeById(items, page.items) : page.items
      );
      setBacktestTradesNextCursor(page.nextCursor);
      return;
    }

    const page = await fetchStrategyBacktestPositions(runId, {
      asOf: options.asOf,
      cursor: options.cursor,
      limit: 100,
    });
    if (!canUpdate()) return;
    setBacktestResultError("");
    setBacktestPositions((items) =>
      options.append ? mergeById(items, page.items) : page.items
    );
    setBacktestPositionsNextCursor(page.nextCursor);
  };

  const loadBacktestDetail = async (
    runId: number,
    canUpdate: () => boolean = () => true
  ) => {
    const [run, equity] = await Promise.all([
      fetchStrategyBacktestRun(runId),
      fetchStrategyBacktestEquity(runId),
    ]);
    if (!canUpdate()) return run;
    setBacktestRun(run);
    setBacktestEquity(equity);
    setBacktestRuns((items) =>
      items.map((item) => (item.id === run.id ? run : item))
    );
    return run;
  };

  useEffect(() => {
    if (activeTab !== "backtests") return;
    refreshBacktests().catch((error) => {
      setLoadError(error instanceof Error ? error.message : String(error));
    });
  }, [activeTab, refreshBacktests]);

  const selectedBacktestRunId = backtestRun?.id;
  const selectedBacktestRunStatus = backtestRun?.status;

  useEffect(() => {
    if (activeTab !== "backtests" || selectedBacktestId === null) {
      setBacktestRun(null);
      setBacktestEquity([]);
      setBacktestSignals([]);
      setBacktestSignalsNextCursor(null);
      setBacktestOrders([]);
      setBacktestOrdersNextCursor(null);
      setBacktestTrades([]);
      setBacktestTradesNextCursor(null);
      setBacktestPositions([]);
      setBacktestPositionsNextCursor(null);
      return;
    }

    let active = true;
    setBacktestRun(null);
    setBacktestEquity([]);
    setBacktestSignals([]);
    setBacktestSignalsNextCursor(null);
    setBacktestOrders([]);
    setBacktestOrdersNextCursor(null);
    setBacktestTrades([]);
    setBacktestTradesNextCursor(null);
    setBacktestPositions([]);
    setBacktestPositionsNextCursor(null);
    setBacktestResultError("");
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const refresh = async () => {
      try {
        const run = await loadBacktestDetail(selectedBacktestId, () => active);
        if (!active) return;
        if (run.status === "pending" || run.status === "running") {
          timeout = setTimeout(() => {
            void refresh();
          }, 3_000);
        }
      } catch (error) {
        if (active) {
          setLoadError(error instanceof Error ? error.message : String(error));
        }
      }
    };
    void refresh();

    return () => {
      active = false;
      if (timeout) clearTimeout(timeout);
    };
  }, [activeTab, selectedBacktestId]);

  useEffect(() => {
    if (
      activeTab !== "backtests" ||
      selectedBacktestId === null ||
      selectedBacktestRunId !== selectedBacktestId ||
      backtestDetailTab === "snapshot" ||
      backtestDetailTab === "error"
    ) {
      return;
    }

    let active = true;
    void loadBacktestFactPage(
      selectedBacktestId,
      backtestDetailTab,
      { asOf: positionAsOf || undefined },
      () => active
    ).catch((error) => {
      if (active) {
        setBacktestResultError(error instanceof Error ? error.message : String(error));
      }
    });

    return () => {
      active = false;
    };
  }, [
    activeTab,
    backtestDetailTab,
    selectedBacktestRunId,
    selectedBacktestRunStatus,
    positionAsOf,
    selectedBacktestId,
  ]);

  const runBacktest = async () => {
    if (!selectedStrategy) return;
    setBacktestCreateError("");
    setIsActionRunning(true);
    try {
      const run = await createStrategyBacktest({
        strategyDefinitionId: selectedStrategy.id,
        strategyVersionId:
          backtestVersionId.trim() === "" ? undefined : Number(backtestVersionId),
        targetUniverse: parseCsv(backtestUniverse),
        period: Number(backtestPeriod),
        source: backtestSource,
        startDate: backtestStartDate,
        endDate: backtestEndDate,
        initialCash: Number(backtestInitialCash),
        maxPositions: Number(backtestMaxPositions),
        slippageBps: Number(backtestSlippageBps),
        commissionRate: Number(backtestCommissionRate),
        minCommission: Number(backtestMinCommission),
        stampDutyRate: Number(backtestStampDutyRate),
        transferFeeRate: Number(backtestTransferFeeRate),
        benchmarkCode: backtestBenchmarkCode,
      });
      setBacktestRuns((items) => [run, ...items.filter((item) => item.id !== run.id)]);
      setSelectedBacktestId(run.id);
      setBacktestRun(run);
      setIsBacktestDrawerOpen(false);
    } catch (error) {
      setBacktestCreateError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsActionRunning(false);
    }
  };

  const openBacktestDrawer = () => {
    setBacktestCreateError("");
    setIsBacktestDrawerOpen(true);
  };

  const closeBacktestDrawer = () => {
    setBacktestCreateError("");
    setIsBacktestDrawerOpen(false);
  };

  const cancelBacktest = async () => {
    if (!backtestRun) return;
    setIsActionRunning(true);
    try {
      const run = await cancelStrategyBacktest(backtestRun.id);
      setBacktestRun(run);
      setBacktestRuns((items) =>
        items.map((item) => (item.id === run.id ? run : item))
      );
    } finally {
      setIsActionRunning(false);
    }
  };

  const loadMoreBacktests = async () => {
    if (!selectedStrategy || !backtestRunsNextCursor) return;
    setIsActionRunning(true);
    try {
      const page = await listStrategyBacktests({
        strategyDefinitionId: selectedStrategy.id,
        status: backtestStatusFilter || undefined,
        cursor: backtestRunsNextCursor,
        limit: 50,
      });
      setBacktestRuns((items) => mergeById(items, page.items));
      setBacktestRunsNextCursor(page.nextCursor);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsActionRunning(false);
    }
  };

  const refreshBacktestPositions = async () => {
    if (!backtestRun) return;
    setIsActionRunning(true);
    try {
      await loadBacktestFactPage(backtestRun.id, "positions", {
        asOf: positionAsOf || undefined,
      });
      setBacktestResultError("");
    } catch (error) {
      setBacktestResultError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsActionRunning(false);
    }
  };

  const loadMoreBacktestFacts = async () => {
    if (!backtestRun) return;
    setIsActionRunning(true);
    try {
      if (backtestDetailTab === "signals" && backtestSignalsNextCursor) {
        await loadBacktestFactPage(backtestRun.id, "signals", {
          cursor: backtestSignalsNextCursor,
          append: true,
        });
      }
      if (backtestDetailTab === "orders" && backtestOrdersNextCursor) {
        await loadBacktestFactPage(backtestRun.id, "orders", {
          cursor: backtestOrdersNextCursor,
          append: true,
        });
      }
      if (backtestDetailTab === "trades" && backtestTradesNextCursor) {
        await loadBacktestFactPage(backtestRun.id, "trades", {
          cursor: backtestTradesNextCursor,
          append: true,
        });
      }
      if (backtestDetailTab === "positions" && backtestPositionsNextCursor) {
        await loadBacktestFactPage(backtestRun.id, "positions", {
          asOf: positionAsOf || undefined,
          cursor: backtestPositionsNextCursor,
          append: true,
        });
      }
      setBacktestResultError("");
    } catch (error) {
      setBacktestResultError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsActionRunning(false);
    }
  };

  const activeFactNextCursor =
    backtestDetailTab === "signals"
      ? backtestSignalsNextCursor
      : backtestDetailTab === "orders"
        ? backtestOrdersNextCursor
        : backtestDetailTab === "trades"
          ? backtestTradesNextCursor
          : backtestDetailTab === "positions"
            ? backtestPositionsNextCursor
            : null;

  return (
    <main className="strategy-page">
      <header className="strategy-header">
        <div>
          <h1>策略工作台</h1>
          <p>管理策略定义、信号、告警和组合回测。</p>
        </div>
        <div className="strategy-header-actions">
          <button disabled={isActionRunning} onClick={runScan} type="button">
            运行扫描
          </button>
          {scanResult ? <span>{scanResult}</span> : null}
        </div>
        <nav className="strategy-nav" aria-label="主导航">
          <a href="/k">K 线</a>
          <a href="/strategies" aria-current="page">
            策略
          </a>
        </nav>
      </header>

      {loadError ? <p className="strategy-error">{loadError}</p> : null}
      {isLoading ? <p className="strategy-muted">正在加载策略平台数据...</p> : null}

      <section className="strategy-shell">
        <aside className="strategy-sidebar">
          <div className="strategy-section-title">
            <h2>策略库</h2>
            <span>{strategies.length} 个策略</span>
          </div>
          <div className="strategy-list">
            {strategies.map((item) => (
              <button
                className={item.id === selectedId ? "selected" : ""}
                key={item.id}
                onClick={() => setSelectedId(item.id)}
                type="button"
              >
                <strong>{item.name}</strong>
                <span>{item.status}</span>
                <small>当前版本 #{item.currentVersionId ?? "-"}</small>
              </button>
            ))}
          </div>
        </aside>

        <section className="strategy-main-panel">
          <div className="strategy-tabs" role="tablist" aria-label="策略工作区">
            {[
              ["registry", "策略详情"],
              ["signals", "信号历史"],
              ["alerts", "告警事件"],
              ["backtests", "组合回测"],
            ].map(([id, label]) => (
              <button
                aria-selected={activeTab === id}
                key={id}
                onClick={() => setActiveTab(id as StrategyTab)}
                role="tab"
                type="button"
              >
                {label}
              </button>
            ))}
          </div>

          {activeTab === "registry" ? (
            <section className="strategy-panel" aria-label="策略详情">
              {selectedStrategy ? (
                <div className="strategy-detail-grid">
                  <div>
                    <h2>{selectedStrategy.name}</h2>
                    <p>{selectedStrategy.description}</p>
                  </div>
                  <dl>
                    <div>
                      <dt>状态</dt>
                      <dd>{statusLabel(selectedStrategy.status)}</dd>
                    </div>
                    <div>
                      <dt>当前版本</dt>
                      <dd>当前版本 #{selectedStrategy.currentVersionId ?? "-"}</dd>
                    </div>
                    <div>
                      <dt>目标证券</dt>
                      <dd>{selectedStrategy.targetUniverse.join(", ")}</dd>
                    </div>
                    <div>
                      <dt>周期/来源</dt>
                      <dd>
                        {selectedStrategy.periods.join(", ")} /{" "}
                        {selectedStrategy.sources.join(", ")}
                      </dd>
                    </div>
                  </dl>
                  <div className="strategy-actions">
                    <button
                      disabled={isActionRunning}
                      onClick={() => setLifecycle("disable")}
                      type="button"
                    >
                      停用
                    </button>
                    <button
                      disabled={isActionRunning}
                      onClick={() => setLifecycle("enable")}
                      type="button"
                    >
                      启用
                    </button>
                    <button
                      disabled={isActionRunning}
                      onClick={runScan}
                      type="button"
                    >
                      扫描当前策略
                    </button>
                  </div>
                </div>
              ) : (
                <p className="strategy-muted">暂无策略定义</p>
              )}

              <div className="strategy-editor">
                <h2>策略编辑</h2>
                <label>
                  策略名称
                  <input value={name} onChange={(event) => setName(event.target.value)} />
                </label>
                <label>
                  描述
                  <input
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                  />
                </label>
                <label>
                  目标证券
                  <input
                    value={targetUniverse}
                    onChange={(event) => setTargetUniverse(event.target.value)}
                  />
                </label>
                <div className="strategy-editor-row">
                  <label>
                    周期
                    <input value={periods} onChange={(event) => setPeriods(event.target.value)} />
                  </label>
                  <label>
                    来源
                    <input value={sources} onChange={(event) => setSources(event.target.value)} />
                  </label>
                  <label>
                    Lookback K 线数
                    <input
                      min="1"
                      max="250"
                      type="number"
                      value={lookbackBars}
                      onChange={(event) => setLookbackBars(event.target.value)}
                    />
                  </label>
                  <label>
                    回测开关
                    <input
                      checked={backtestEnabled}
                      type="checkbox"
                      onChange={(event) => setBacktestEnabled(event.target.checked)}
                    />
                  </label>
                </div>
                <label>
                  入场规则 JSON
                  <textarea
                    rows={8}
                    value={entryRuleText}
                    onChange={(event) => setEntryRuleText(event.target.value)}
                  />
                </label>
                <label>
                  出场规则 JSON
                  <textarea
                    rows={8}
                    value={exitRuleText}
                    onChange={(event) => setExitRuleText(event.target.value)}
                  />
                </label>
                <p className="strategy-muted">{editorBacktestGuidance}</p>
                {editorError ? <p className="strategy-error">{editorError}</p> : null}
                <div className="strategy-actions">
                  <button disabled={isSaving} onClick={saveStrategy} type="button">
                    保存策略
                  </button>
                  <button
                    disabled={isSaving || !selectedStrategy}
                    onClick={updateCurrentStrategy}
                    type="button"
                  >
                    更新当前策略
                  </button>
                </div>
              </div>

              <section className="strategy-table-wrap">
                <h2>版本</h2>
                <table>
                  <thead>
                    <tr>
                      <th>版本</th>
                      <th>Schema</th>
                      <th>创建时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {versions.map((item) => (
                      <tr key={item.id}>
                        <td>版本 {item.versionNumber}</td>
                        <td>{item.ruleSchemaVersion}</td>
                        <td>{formatDateTime(item.createTime)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </section>
          ) : null}

          {activeTab === "signals" ? (
            <section className="strategy-panel" aria-label="信号历史">
              <h2>信号历史</h2>
              <table>
                <thead>
                  <tr>
                    <th>策略</th>
                    <th>版本</th>
                    <th>证券</th>
                    <th>周期</th>
                    <th>来源</th>
                    <th>时间</th>
                  </tr>
                </thead>
                <tbody>
                  {signals.map((item) => (
                    <tr key={item.id}>
                      <td>{item.strategyDefinitionId}</td>
                      <td>{item.strategyVersionId}</td>
                      <td>{item.securityCode}</td>
                      <td>{item.period}</td>
                      <td>{item.source}</td>
                      <td>{formatDateTime(item.signalTime)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ) : null}

          {activeTab === "alerts" ? (
            <section className="strategy-panel" aria-label="告警事件">
              <h2>告警事件</h2>
              <table>
                <thead>
                  <tr>
                    <th>事件</th>
                    <th>信号</th>
                    <th>状态</th>
                    <th>去重键</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.map((item) => (
                    <tr key={item.id}>
                      <td>{item.id}</td>
                      <td>{item.strategySignalId}</td>
                      <td>{item.status}</td>
                      <td>{item.dedupeKey}</td>
                      <td>
                        <button
                          disabled={isActionRunning || item.status === "acked"}
                          onClick={() => acknowledgeAlert(item.id)}
                          type="button"
                        >
                          确认告警
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ) : null}

          {activeTab === "backtests" ? (
            <section className="strategy-panel" aria-label="组合回测">
              <div className="backtest-workspace">
                <aside className="backtest-history">
                  <div className="strategy-section-title">
                    <div>
                      <h2>回测历史</h2>
                      <span>{backtestRuns.length} 次运行</span>
                    </div>
                    <button
                      disabled={!selectedStrategy}
                      onClick={openBacktestDrawer}
                      type="button"
                    >
                      新建组合回测
                    </button>
                  </div>
                  <label>
                    回测状态筛选
                    <select
                      aria-label="回测状态筛选"
                      value={backtestStatusFilter}
                      onChange={(event) =>
                        setBacktestStatusFilter(event.target.value as BacktestRunStatus | "")
                      }
                    >
                      <option value="">全部状态</option>
                      <option value="pending">pending</option>
                      <option value="running">running</option>
                      <option value="completed">completed</option>
                      <option value="failed">failed</option>
                      <option value="cancelled">cancelled</option>
                    </select>
                  </label>
                  <div className="backtest-run-list">
                    {backtestRuns.map((item) => (
                      <button
                        className={item.id === selectedBacktestId ? "selected" : ""}
                        key={item.id}
                        onClick={() => setSelectedBacktestId(item.id)}
                        type="button"
                      >
                        <strong>运行 #{item.id}</strong>
                        <span>{statusLabel(item.status)}</span>
                        <small>
                          {item.startDate} 至 {item.endDate}
                        </small>
                        <small>
                          {item.status === "completed"
                            ? `收益 ${((item.metrics?.totalReturn ?? 0) * 100).toFixed(2)}%`
                            : `进度 ${item.progressPercent.toFixed(0)}%`}
                        </small>
                      </button>
                    ))}
                    {backtestRuns.length === 0 ? (
                      <p className="strategy-muted">尚无组合回测运行。</p>
                    ) : null}
                    {backtestRunsNextCursor ? (
                      <button
                        disabled={isActionRunning}
                        onClick={loadMoreBacktests}
                        type="button"
                      >
                        加载更多运行
                      </button>
                    ) : null}
                  </div>
                </aside>

                <div className="backtest-detail">
                  {backtestRun ? (
                    <>
                      <div className="backtest-detail-header">
                        <div>
                          <h2>运行 #{backtestRun.id}</h2>
                          <p>
                            {backtestRun.targetUniverse.join(", ")} / {backtestRun.source} / {backtestRun.period}
                          </p>
                        </div>
                        <div className="strategy-actions">
                          <strong>{statusLabel(backtestRun.status as BacktestRunStatus)}</strong>
                          {backtestRun.status === "pending" || backtestRun.status === "running" ? (
                            <button
                              disabled={isActionRunning}
                              onClick={cancelBacktest}
                              type="button"
                            >
                              取消回测
                            </button>
                          ) : null}
                        </div>
                      </div>

                      <div className="strategy-metrics">
                        <span>阶段 {backtestRun.stage}</span>
                        <span>
                          进度 {backtestRun.processedWork}/{backtestRun.totalWork} ({backtestRun.progressPercent.toFixed(0)}%)
                        </span>
                        <span>尝试 {backtestRun.attemptCount}</span>
                        <span>信号 {backtestRun.signalCount}</span>
                        <span>证券 {backtestRun.matchedSecurityCount}</span>
                        {backtestRun.startedAt ? (
                          <span>开始 {formatDateTime(backtestRun.startedAt)}</span>
                        ) : null}
                        {backtestRun.completedAt ? (
                          <span>结束 {formatDateTime(backtestRun.completedAt)}</span>
                        ) : null}
                      </div>

                      <div className="backtest-metric-grid">
                        {[
                          ["总收益", formatPercentMetric(backtestRun.metrics?.totalReturn)],
                          ["年化收益", formatPercentMetric(backtestRun.metrics?.annualizedReturn)],
                          ["年化波动", formatPercentMetric(backtestRun.metrics?.annualizedVolatility)],
                          ["夏普比率", formatMetric(backtestRun.metrics?.sharpeRatio)],
                          ["最大回撤", formatPercentMetric(backtestRun.metrics?.maxDrawdown)],
                          ["回撤周期", formatMetric(backtestRun.metrics?.maxDrawdownDuration, " 日")],
                          ["Calmar", formatMetric(backtestRun.metrics?.calmarRatio)],
                          ["基准收益", formatPercentMetric(backtestRun.metrics?.benchmarkReturn)],
                          ["超额收益", formatPercentMetric(backtestRun.metrics?.excessReturn)],
                          ["胜率", formatPercentMetric(backtestRun.metrics?.winRate)],
                          ["盈亏比", formatMetric(backtestRun.metrics?.profitFactor)],
                          ["交易数", formatMetric(backtestRun.metrics?.tradeCount)],
                          ["平均持有", formatMetric(backtestRun.metrics?.averageHoldingDays, " 日")],
                          ["换手率", formatMetric(backtestRun.metrics?.turnover)],
                          ["平均仓位", formatPercentMetric(backtestRun.metrics?.averageExposure)],
                        ].map(([label, value]) => (
                          <div key={label}>
                            <span>{label}</span>
                            <strong>{value}</strong>
                          </div>
                        ))}
                      </div>

                      <BacktestEquityChart points={backtestEquity} />
                      <p className="strategy-muted">
                        使用存储的前复权日线、下一可得开盘价和全额成交假设；不建模分红、拆并股、涨跌停、ST、流动性和部分成交。
                      </p>

                      <div className="strategy-tabs" role="tablist" aria-label="回测详情">
                        {[
                          ["trades", "交易"],
                          ["orders", "订单"],
                          ["signals", "信号"],
                          ["positions", "持仓"],
                          ["snapshot", "快照"],
                          ["error", "错误"],
                        ].map(([id, label]) => (
                          <button
                            aria-selected={backtestDetailTab === id}
                            key={id}
                            onClick={() =>
                              setBacktestDetailTab(id as BacktestDetailTab)
                            }
                            role="tab"
                            type="button"
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      {backtestResultError ? (
                        <p className="strategy-error">{backtestResultError}</p>
                      ) : null}

                      {backtestDetailTab === "trades" ? (
                        <>
                        <table>
                          <thead>
                            <tr>
                              <th>证券</th>
                              <th>状态</th>
                              <th>入场</th>
                              <th>出场</th>
                              <th>数量</th>
                              <th>盈亏</th>
                            </tr>
                          </thead>
                          <tbody>
                            {backtestTrades.map((item) => (
                              <tr key={item.id}>
                                <td>{item.securityCode}</td>
                                <td>{item.status}</td>
                                <td>{formatDateTime(item.entryTime)}</td>
                                <td>{formatDateTime(item.exitTime)}</td>
                                <td>{item.quantity}</td>
                                <td>{item.realizedPnl ?? "-"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {backtestTrades.length === 0 ? (
                          <p className="strategy-muted">暂无交易结果。</p>
                        ) : null}
                        </>
                      ) : null}

                      {backtestDetailTab === "orders" ? (
                        <>
                        <table>
                          <thead>
                            <tr>
                              <th>证券</th>
                              <th>方向</th>
                              <th>状态</th>
                              <th>计划时间</th>
                              <th>成交/过期时间</th>
                              <th>数量</th>
                              <th>原因</th>
                            </tr>
                          </thead>
                          <tbody>
                            {backtestOrders.map((item) => (
                              <tr key={item.id}>
                                <td>{item.securityCode}</td>
                                <td>{item.side}</td>
                                <td>{item.status}</td>
                                <td>{formatDateTime(item.scheduledTime)}</td>
                                <td>{formatDateTime(item.executionTime ?? item.expiredAt)}</td>
                                <td>{item.quantity}</td>
                                <td>{item.reason ?? "-"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {backtestOrders.length === 0 ? (
                          <p className="strategy-muted">暂无订单结果。</p>
                        ) : null}
                        </>
                      ) : null}

                      {backtestDetailTab === "signals" ? (
                        <>
                        <table>
                          <thead>
                            <tr>
                              <th>证券</th>
                              <th>种类</th>
                              <th>时间</th>
                              <th>规则</th>
                            </tr>
                          </thead>
                          <tbody>
                            {backtestSignals.map((item) => (
                              <tr key={item.id}>
                                <td>{item.securityCode}</td>
                                <td>{item.signalKind}</td>
                                <td>{formatDateTime(item.signalTime)}</td>
                                <td>{formatJson(item.ruleSnapshot)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {backtestSignals.length === 0 ? (
                          <p className="strategy-muted">暂无信号结果。</p>
                        ) : null}
                        </>
                      ) : null}

                      {backtestDetailTab === "positions" ? (
                        <>
                          <div className="strategy-actions">
                            <label>
                              持仓截止日期
                              <input
                                aria-label="持仓截止日期"
                                type="date"
                                value={positionAsOf}
                                onChange={(event) => setPositionAsOf(event.target.value)}
                              />
                            </label>
                            <button
                              disabled={isActionRunning}
                              onClick={refreshBacktestPositions}
                              type="button"
                            >
                              查询持仓
                            </button>
                          </div>
                          <table>
                            <thead>
                              <tr>
                                <th>证券</th>
                                <th>入场时间</th>
                                <th>数量</th>
                                <th>入场价</th>
                              </tr>
                            </thead>
                            <tbody>
                              {backtestPositions.map((item) => (
                                <tr key={item.id}>
                                  <td>{item.securityCode}</td>
                                  <td>{formatDateTime(item.entryTime)}</td>
                                  <td>{item.quantity}</td>
                                  <td>{item.entryPrice}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {backtestPositions.length === 0 ? (
                            <p className="strategy-muted">该时点暂无持仓。</p>
                          ) : null}
                        </>
                      ) : null}

                      {backtestDetailTab === "snapshot" ? (
                        <div className="backtest-snapshots">
                          <pre>{formatJson(backtestRun.strategySnapshot)}</pre>
                          <pre>{formatJson(backtestRun.configSnapshot)}</pre>
                          {backtestRun.errorDetails ? (
                            <pre>{formatJson(backtestRun.errorDetails)}</pre>
                          ) : null}
                        </div>
                      ) : null}

                      {backtestDetailTab === "error" ? (
                        <div className="backtest-snapshots">
                          {backtestRun.errorCode || backtestRun.errorMessage ? (
                            <pre>{formatJson({
                              code: backtestRun.errorCode ?? null,
                              message: backtestRun.errorMessage ?? null,
                              details: backtestRun.errorDetails ?? null,
                            })}</pre>
                          ) : (
                            <p className="strategy-muted">该运行没有结构化错误。</p>
                          )}
                          {backtestResultError ? (
                            <p className="strategy-error">{backtestResultError}</p>
                          ) : null}
                        </div>
                      ) : null}

                      {activeFactNextCursor ? (
                        <button
                          disabled={isActionRunning}
                          onClick={loadMoreBacktestFacts}
                          type="button"
                        >
                          加载更多结果
                        </button>
                      ) : null}
                    </>
                  ) : (
                    <div className="backtest-empty-state">
                      <h2>选择一次回测运行</h2>
                      <p>从左侧历史选择运行，或新建一组组合回测配置。</p>
                    </div>
                  )}
                </div>
              </div>

              {isBacktestDrawerOpen ? (
                <div className="backtest-drawer" role="dialog" aria-label="新建组合回测">
                  <div className="backtest-drawer-header">
                    <h2>新建组合回测</h2>
                    <button onClick={closeBacktestDrawer} type="button">
                      关闭
                    </button>
                  </div>
                  {backtestEligibilityReason ? (
                    <p className="strategy-error">{backtestEligibilityReason}</p>
                  ) : null}
                  {backtestCreateError ? (
                    <p className="strategy-error" role="alert">
                      {backtestCreateError}
                    </p>
                  ) : null}
                  <div className="strategy-editor-row">
                    <label>
                      回测版本 ID
                      <input
                        value={backtestVersionId}
                        onChange={(event) => setBacktestVersionId(event.target.value)}
                      />
                    </label>
                    <label>
                      回测证券
                      <input
                        value={backtestUniverse}
                        onChange={(event) => setBacktestUniverse(event.target.value)}
                      />
                    </label>
                  </div>
                  <div className="strategy-editor-row">
                    <label>
                      周期
                      <input
                        value={backtestPeriod}
                        onChange={(event) => setBacktestPeriod(event.target.value)}
                      />
                    </label>
                    <label>
                      来源
                      <select
                        value={backtestSource}
                        onChange={(event) => setBacktestSource(event.target.value as DataSourceValue)}
                      >
                        <option value="tdx">tdx</option>
                        <option value="ef">ef</option>
                        <option value="qmt">qmt</option>
                      </select>
                    </label>
                    <label>
                      开始日期
                      <input
                        type="date"
                        value={backtestStartDate}
                        onChange={(event) => setBacktestStartDate(event.target.value)}
                      />
                    </label>
                    <label>
                      结束日期
                      <input
                        type="date"
                        value={backtestEndDate}
                        onChange={(event) => setBacktestEndDate(event.target.value)}
                      />
                    </label>
                  </div>
                  <div className="strategy-editor-row">
                    <label>
                      初始资金
                      <input value={backtestInitialCash} onChange={(event) => setBacktestInitialCash(event.target.value)} />
                    </label>
                    <label>
                      最大持仓
                      <input value={backtestMaxPositions} onChange={(event) => setBacktestMaxPositions(event.target.value)} />
                    </label>
                    <label>
                      滑点 bps
                      <input value={backtestSlippageBps} onChange={(event) => setBacktestSlippageBps(event.target.value)} />
                    </label>
                    <label>
                      基准代码
                      <input value={backtestBenchmarkCode} onChange={(event) => setBacktestBenchmarkCode(event.target.value)} />
                    </label>
                  </div>
                  <div className="strategy-editor-row">
                    <label>
                      佣金率
                      <input value={backtestCommissionRate} onChange={(event) => setBacktestCommissionRate(event.target.value)} />
                    </label>
                    <label>
                      最低佣金
                      <input value={backtestMinCommission} onChange={(event) => setBacktestMinCommission(event.target.value)} />
                    </label>
                    <label>
                      印花税率
                      <input value={backtestStampDutyRate} onChange={(event) => setBacktestStampDutyRate(event.target.value)} />
                    </label>
                    <label>
                      过户费率
                      <input value={backtestTransferFeeRate} onChange={(event) => setBacktestTransferFeeRate(event.target.value)} />
                    </label>
                  </div>
                  <div className="strategy-actions">
                    <button
                      disabled={isActionRunning || Boolean(backtestEligibilityReason)}
                      onClick={runBacktest}
                      type="button"
                    >
                      提交组合回测
                    </button>
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}
        </section>
      </section>
    </main>
  );
}
