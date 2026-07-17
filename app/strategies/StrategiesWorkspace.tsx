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
  type StrategyBacktestSourceValue,
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

const STRATEGY_BACKTEST_SOURCES = new Set<StrategyBacktestSourceValue>([
  "tdx",
  "qmt",
]);
const DATA_SOURCE_VALUES = new Set<DataSourceValue>(["ef", "tdx", "qmt"]);

const isStrategyBacktestSource = (
  source: DataSourceValue
): source is StrategyBacktestSourceValue =>
  STRATEGY_BACKTEST_SOURCES.has(source as StrategyBacktestSourceValue);

const formatJson = (value: unknown) => JSON.stringify(value ?? {}, null, 2);

const parseCsv = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const parseNumberCsv = (value: string, label: string) => {
  const tokens = parseCsv(value);
  const numbers = tokens.map((item) => Number(item));
  if (numbers.some((item) => !Number.isFinite(item))) {
    throw new Error(`${label}必须是逗号分隔的有效数字`);
  }
  return numbers;
};

const parseDataSourceCsv = (value: string) => {
  const sources = parseCsv(value);
  const invalid = sources.filter(
    (source) => !DATA_SOURCE_VALUES.has(source as DataSourceValue)
  );
  if (invalid.length > 0) {
    throw new Error(`数据来源无效：${invalid.join("、")}`);
  }
  return sources as DataSourceValue[];
};

const parseOptionalNumber = (
  value: string,
  label: string,
  options: { integer?: boolean; min?: number; max?: number } = {}
) => {
  const trimmed = value.trim();
  if (trimmed === "") return undefined;
  const numeric = Number(trimmed);
  if (
    !Number.isFinite(numeric) ||
    (options.integer && !Number.isInteger(numeric)) ||
    (options.min !== undefined && numeric < options.min) ||
    (options.max !== undefined && numeric > options.max)
  ) {
    throw new Error(`${label}格式或范围无效`);
  }
  return numeric;
};

const MAX_BACKTEST_CNY = 1e12;

const beijingDateTimeFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

const beijingDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  // Intl formats as "YYYY-MM-DD, HH:MM:SS"; drop the comma for compactness.
  return beijingDateTimeFormatter.format(parsed).replace(", ", " ");
};

// Date-only Beijing formatter: a persisted Beijing-midnight instant
// (e.g. 2025-12-31T16:00:00Z) must render as its Beijing calendar date
// (2026-01-01), not the raw ISO string.
const formatBeijingDate = (value?: string | null) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return beijingDateFormatter.format(parsed);
};

const statusLabel = (status?: string) => status || "-";

const formatMetric = (value: number | null | undefined, suffix = "") =>
  value === null || value === undefined ? "-" : `${value.toFixed(2)}${suffix}`;

const formatPercentMetric = (value: number | null | undefined) =>
  value === null || value === undefined ? "-" : formatMetric(value * 100, "%");

const formatSnapshotString = (
  snapshot: Record<string, unknown> | undefined,
  key: string
) => (typeof snapshot?.[key] === "string" ? snapshot[key] : "未记录");

const BACKTEST_LIMITATION_LABELS: Record<string, string> = {
  dividends_not_modeled: "分红",
  splits_not_modeled: "拆并股",
  rights_issues_not_modeled: "配股",
  full_price_limit_rules_not_modeled: "涨跌停",
  st_rules_not_modeled: "ST",
  liquidity_not_modeled: "流动性",
  partial_fills_not_modeled: "部分成交",
};

const formatBacktestAssumptions = (
  snapshot: Record<string, unknown> | undefined
) => {
  const assumption =
    typeof snapshot?.executionAssumption === "string"
      ? snapshot.executionAssumption
      : "";
  const limitationText =
    assumption === "full_fill_at_adjusted_next_open"
      ? "使用下一可得开盘价和全额成交假设"
      : assumption || "执行假设未记录";
  const limitations = Array.isArray(snapshot?.limitations)
    ? (snapshot!.limitations as unknown[])
        .filter((item): item is string => typeof item === "string")
        .map((item) => BACKTEST_LIMITATION_LABELS[item] ?? item)
        .join("、")
    : "";
  const notModeled = limitations ? `；不建模${limitations}` : "";
  return `${limitationText}${notModeled}。`;
};

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
    }).catch(() => {
      // Dynamic echarts load failure: leave chart null; cleanup runs safely.
      // A visible error state for chart-load failure is a future enhancement.
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
  const backtestStatusFilterRef = useRef(backtestStatusFilter || undefined);
  useEffect(() => {
    backtestStatusFilterRef.current = backtestStatusFilter || undefined;
  }, [backtestStatusFilter]);
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
  const [positionAsOfDraft, setPositionAsOfDraft] = useState("");
  const [positionAsOfApplied, setPositionAsOfApplied] = useState("");
  const [factRefreshGeneration, setFactRefreshGeneration] = useState(0);
  const [backtestDetailTab, setBacktestDetailTab] = useState<BacktestDetailTab>("trades");
  const [isBacktestDrawerOpen, setIsBacktestDrawerOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isActionRunning, setIsActionRunning] = useState(false);
  const [isLoadingMoreBacktests, setIsLoadingMoreBacktests] = useState(false);
  const [isLoadingMoreFacts, setIsLoadingMoreFacts] = useState(false);
  const [isCancellingBacktest, setIsCancellingBacktest] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [backtestCreateError, setBacktestCreateError] = useState("");
  const [backtestResultError, setBacktestResultError] = useState("");
  const [backtestEquityError, setBacktestEquityError] = useState("");
  const [backtestCancelError, setBacktestCancelError] = useState("");
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
  const [backtestSource, setBacktestSource] = useState<
    StrategyBacktestSourceValue | ""
  >("tdx");
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

  // Mirror the current selected strategy id into a ref so async handlers can
  // detect whether the selection changed while their request was in flight.
  const selectedStrategyIdRef = useRef<number | null>(selectedId);
  const runListRequestGenerationRef = useRef(0);
  const factRequestGenerationRef = useRef(0);
  useEffect(() => {
    selectedStrategyIdRef.current = selectedId;
  }, [selectedId]);

  // Mirror the current backtest run id and detail tab into refs so paged fact
  // fetches can detect whether the run/tab changed while the request was in
  // flight, and drop stale append results.
  const backtestRunIdRef = useRef<number | null>(null);
  const backtestDetailTabRef = useRef<BacktestDetailTab>(backtestDetailTab);
  const positionAsOfAppliedRef = useRef(positionAsOfApplied);
  useEffect(() => {
    backtestRunIdRef.current = backtestRun?.id ?? null;
  }, [backtestRun?.id]);
  useEffect(() => {
    backtestDetailTabRef.current = backtestDetailTab;
  }, [backtestDetailTab]);
  useEffect(() => {
    positionAsOfAppliedRef.current = positionAsOfApplied;
  }, [positionAsOfApplied]);

  // currentVersion must only resolve from versions that belong to the CURRENTLY
  // selected strategy. A cross-strategy versions[0] fallback would let a stale
  // previous strategy's rule bleed into the editor during/after a switch.
  const currentVersion = useMemo(
    () =>
      versions.find((item) => item.id === selectedStrategy?.currentVersionId) ||
      null,
    [selectedStrategy?.currentVersionId, versions]
  );

  const backtestSourceOptions = useMemo(
    () => selectedStrategy?.sources.filter(isStrategyBacktestSource) ?? [],
    [selectedStrategy]
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
    if (backtestSourceOptions.length === 0) {
      return "组合回测需要策略配置 tdx 或 qmt 数据来源。";
    }
    return "";
  }, [backtestSourceOptions.length, currentVersion?.exitRule, selectedStrategy]);

  const editorBacktestGuidance = useMemo(() => {
    if (!backtestEnabled) return "关闭时可保留空的出场规则，仅用于实时入场信号。";
    if (exitRuleText.trim() === "") return "开启回测前必须填写出场规则 JSON。";
    if (!parseCsv(periods).some((period) => Number(period) === 1440)) {
      return "开启回测时必须包含日线周期 1440。";
    }
    if (!(parseCsv(sources) as DataSourceValue[]).some(isStrategyBacktestSource)) {
      return "开启回测时必须至少包含 tdx 或 qmt 数据来源。";
    }
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

    // Clear stale versions immediately on strategy switch so currentVersion
    // cannot briefly resolve to the previous strategy's versions[0] while the
    // new fetch is in flight.
    setVersions([]);
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
    const configuredBacktestSources = selectedStrategy.sources.filter(
      isStrategyBacktestSource
    );
    setBacktestSource((current) =>
      current && configuredBacktestSources.includes(current)
        ? current
        : configuredBacktestSources[0] ?? ""
    );
  }, [selectedStrategy]);

  useEffect(() => {
    // While versions for the selected strategy are still loading (or failed),
    // currentVersion is null — clear the rule fields so the editor cannot
    // submit the previous strategy's rules as a new version of the current one.
    if (!currentVersion) {
      setEntryRuleText("");
      setExitRuleText("");
      setLookbackBars("");
      return;
    }
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

  const buildStrategyPayload = (): Parameters<
    typeof createStrategyDefinition
  >[0] => {
    const { entryRule, exitRule } = parseEditorRules();
    return {
      name,
      description,
      targetUniverse: parseCsv(targetUniverse),
      periods: parseNumberCsv(periods, "周期"),
      sources: parseDataSourceCsv(sources),
      entryRule,
      exitRule,
      lookbackBars: parseLookbackBars(),
      backtestEnabled,
    };
  };

  const saveStrategy = async () => {
    setEditorError("");
    setIsSaving(true);
    try {
      await createStrategyDefinition(buildStrategyPayload());
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
    setIsSaving(true);
    try {
      await updateStrategyDefinition(selectedStrategy.id, buildStrategyPayload());
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
    const requestedStrategyId = selectedStrategy?.id;
    const requestedFilter = backtestStatusFilter || undefined;
    const requestGeneration = ++runListRequestGenerationRef.current;
    setIsLoadingMoreBacktests(false);
    try {
      const page = await listStrategyBacktests({
        strategyDefinitionId: requestedStrategyId,
        status: requestedFilter,
        limit: 50,
      });
      if (
        requestGeneration !== runListRequestGenerationRef.current ||
        requestedStrategyId !== selectedStrategyIdRef.current ||
        requestedFilter !== backtestStatusFilterRef.current
      ) {
        return page.items;
      }
      setBacktestRuns(page.items);
      setBacktestRunsNextCursor(page.nextCursor);
      setSelectedBacktestId((current) =>
        page.items.some((item) => item.id === current)
          ? current
          : page.items[0]?.id ?? null
      );
      setLoadError("");
      return page.items;
    } catch (error) {
      if (
        requestGeneration === runListRequestGenerationRef.current &&
        requestedStrategyId === selectedStrategyIdRef.current &&
        requestedFilter === backtestStatusFilterRef.current
      ) {
        setLoadError(error instanceof Error ? error.message : String(error));
      }
      return [];
    }
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

  const loadBacktestRun = async (
    runId: number,
    canUpdate: () => boolean = () => true
  ) => {
    const run = await fetchStrategyBacktestRun(runId);
    if (!canUpdate()) return run;
    setBacktestRun(run);
    setBacktestRuns((items) =>
      items.map((item) => (item.id === run.id ? run : item))
    );
    return run;
  };

  const loadBacktestEquity = async (
    runId: number,
    canUpdate: () => boolean = () => true
  ) => {
    const equity = await fetchStrategyBacktestEquity(runId);
    if (!canUpdate()) return;
    setBacktestEquity(equity);
  };

  useEffect(() => {
    if (activeTab !== "backtests") return;
    void refreshBacktests();
  }, [activeTab, refreshBacktests]);

  const selectedBacktestRunId = backtestRun?.id;

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
      setPositionAsOfDraft("");
      setPositionAsOfApplied("");
      setBacktestResultError("");
      setBacktestEquityError("");
      setBacktestCancelError("");
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
    setPositionAsOfDraft("");
    setPositionAsOfApplied("");
    setBacktestResultError("");
    setBacktestEquityError("");
    setBacktestCancelError("");
    let previousStatus: string | undefined;
    let runTimeout: ReturnType<typeof setTimeout> | undefined;
    let equityTimeout: ReturnType<typeof setTimeout> | undefined;
    let runFailures = 0;
    let equityRequestGeneration = 0;
    const MAX_ATTEMPTS = 3;

    const refreshEquity = (requestGeneration: number, attempt = 1) => {
      void loadBacktestEquity(selectedBacktestId, () =>
        active && requestGeneration === equityRequestGeneration
      )
        .then(() => {
          if (active && requestGeneration === equityRequestGeneration) {
            setBacktestEquityError("");
          }
        })
        .catch((error) => {
          if (!active || requestGeneration !== equityRequestGeneration) return;
          if (attempt < MAX_ATTEMPTS) {
            equityTimeout = setTimeout(
              () => refreshEquity(requestGeneration, attempt + 1),
              3_000
            );
            return;
          }
          setBacktestEquityError(
            error instanceof Error ? error.message : String(error)
          );
        });
    };

    const startEquityRefresh = () => {
      equityRequestGeneration += 1;
      if (equityTimeout) clearTimeout(equityTimeout);
      refreshEquity(equityRequestGeneration);
    };

    const scheduleRunRefresh = () => {
      runTimeout = setTimeout(() => void refreshRun(), 3_000);
    };

    const refreshRun = async () => {
      try {
        const run = await loadBacktestRun(selectedBacktestId, () => active);
        if (!active) return;
        const isTerminal =
          run.status !== "pending" && run.status !== "running";
        const justBecameTerminal =
          isTerminal &&
          previousStatus !== undefined &&
          previousStatus !== run.status;

        previousStatus = run.status;
        if (justBecameTerminal) {
          setFactRefreshGeneration((generation) => generation + 1);
          startEquityRefresh();
        }
        runFailures = 0;
        if (!isTerminal) scheduleRunRefresh();
      } catch (error) {
        if (!active) return;
        runFailures += 1;
        if (runFailures < MAX_ATTEMPTS) {
          scheduleRunRefresh();
        } else {
          setLoadError(
            error instanceof Error ? error.message : String(error)
          );
        }
      }
    };
    startEquityRefresh();
    void refreshRun();

    return () => {
      active = false;
      equityRequestGeneration += 1;
      if (runTimeout) clearTimeout(runTimeout);
      if (equityTimeout) clearTimeout(equityTimeout);
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
    const requestGeneration = ++factRequestGenerationRef.current;
    setIsLoadingMoreFacts(false);
    const canUpdate = () =>
      active &&
      requestGeneration === factRequestGenerationRef.current &&
      backtestRunIdRef.current === selectedBacktestId &&
      backtestDetailTabRef.current === backtestDetailTab &&
      positionAsOfAppliedRef.current === positionAsOfApplied;
    void loadBacktestFactPage(
      selectedBacktestId,
      backtestDetailTab,
      { asOf: positionAsOfApplied || undefined },
      canUpdate
    ).catch((error) => {
      if (canUpdate()) {
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
    positionAsOfApplied,
    factRefreshGeneration,
    selectedBacktestId,
  ]);

  const runBacktest = async () => {
    if (!selectedStrategy) return;
    setBacktestCreateError("");
    if (!backtestSource) {
      setBacktestCreateError("组合回测需要策略配置 tdx 或 qmt 数据来源。");
      return;
    }
    setIsActionRunning(true);
    try {
      const run = await createStrategyBacktest({
        strategyDefinitionId: selectedStrategy.id,
        strategyVersionId: parseOptionalNumber(backtestVersionId, "策略版本", {
          integer: true,
          min: 1,
        }),
        targetUniverse: parseCsv(backtestUniverse),
        // Daily is the only supported period; send the literal rather than
        // echoing a free-text input.
        period: 1440,
        source: backtestSource,
        startDate: backtestStartDate,
        endDate: backtestEndDate,
        initialCash: parseOptionalNumber(backtestInitialCash, "初始资金", {
          min: 0.01,
          max: MAX_BACKTEST_CNY,
        }),
        maxPositions: parseOptionalNumber(backtestMaxPositions, "最大持仓数", {
          integer: true,
          min: 1,
          max: 50,
        }),
        slippageBps: parseOptionalNumber(backtestSlippageBps, "滑点", {
          min: 0,
          max: 10_000,
        }),
        commissionRate: parseOptionalNumber(backtestCommissionRate, "佣金率", {
          min: 0,
          max: 1,
        }),
        minCommission: parseOptionalNumber(backtestMinCommission, "最低佣金", {
          min: 0,
          max: MAX_BACKTEST_CNY,
        }),
        stampDutyRate: parseOptionalNumber(backtestStampDutyRate, "印花税率", {
          min: 0,
          max: 1,
        }),
        transferFeeRate: parseOptionalNumber(backtestTransferFeeRate, "过户费率", {
          min: 0,
          max: 1,
        }),
        benchmarkCode: backtestBenchmarkCode,
      });
      setBacktestRuns((items) => [run, ...items.filter((item) => item.id !== run.id)]);
      setSelectedBacktestId(run.id);
      setBacktestRun(run);
      setBacktestCancelError("");
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
    setBacktestCancelError("");
    setIsCancellingBacktest(true);
    try {
      const run = await cancelStrategyBacktest(backtestRun.id);
      setBacktestRun(run);
      setBacktestRuns((items) =>
        items.map((item) => (item.id === run.id ? run : item))
      );
      setBacktestCancelError("");
    } catch (error) {
      setBacktestCancelError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsCancellingBacktest(false);
    }
  };

  const loadMoreBacktests = async () => {
    if (!selectedStrategy || !backtestRunsNextCursor) return;
    const requestedStrategyId = selectedStrategy.id;
    const requestedFilter = backtestStatusFilter || undefined;
    const requestedCursor = backtestRunsNextCursor;
    const requestGeneration = ++runListRequestGenerationRef.current;
    setIsLoadingMoreBacktests(true);
    try {
      const page = await listStrategyBacktests({
        strategyDefinitionId: requestedStrategyId,
        status: requestedFilter,
        cursor: requestedCursor,
        limit: 50,
      });
      if (
        requestGeneration !== runListRequestGenerationRef.current ||
        requestedStrategyId !== selectedStrategyIdRef.current ||
        requestedFilter !== backtestStatusFilterRef.current
      ) {
        return;
      }
      setBacktestRuns((items) => mergeById(items, page.items));
      setBacktestRunsNextCursor(page.nextCursor);
    } catch (error) {
      if (
        requestGeneration === runListRequestGenerationRef.current &&
        requestedStrategyId === selectedStrategyIdRef.current &&
        requestedFilter === backtestStatusFilterRef.current
      ) {
        setLoadError(error instanceof Error ? error.message : String(error));
      }
    } finally {
      if (requestGeneration === runListRequestGenerationRef.current) {
        setIsLoadingMoreBacktests(false);
      }
    }
  };

  const refreshBacktestPositions = () => {
    if (!backtestRun) return;
    if (positionAsOfDraft !== positionAsOfApplied) {
      setPositionAsOfApplied(positionAsOfDraft);
      return;
    }
    setFactRefreshGeneration((generation) => generation + 1);
  };

  const loadMoreBacktestFacts = async () => {
    if (!backtestRun) return;
    const requestedRunId = backtestRun.id;
    const requestedTab = backtestDetailTab;
    const requestedAsOf = positionAsOfApplied;
    const requestGeneration = ++factRequestGenerationRef.current;
    const stillCurrent = () =>
      requestGeneration === factRequestGenerationRef.current &&
      backtestRunIdRef.current === requestedRunId &&
      backtestDetailTabRef.current === requestedTab &&
      positionAsOfAppliedRef.current === requestedAsOf;
    setIsLoadingMoreFacts(true);
    try {
      if (backtestDetailTab === "signals" && backtestSignalsNextCursor) {
        await loadBacktestFactPage(
          backtestRun.id,
          "signals",
          { cursor: backtestSignalsNextCursor, append: true },
          stillCurrent,
        );
      }
      if (backtestDetailTab === "orders" && backtestOrdersNextCursor) {
        await loadBacktestFactPage(
          backtestRun.id,
          "orders",
          { cursor: backtestOrdersNextCursor, append: true },
          stillCurrent,
        );
      }
      if (backtestDetailTab === "trades" && backtestTradesNextCursor) {
        await loadBacktestFactPage(
          backtestRun.id,
          "trades",
          { cursor: backtestTradesNextCursor, append: true },
          stillCurrent,
        );
      }
      if (backtestDetailTab === "positions" && backtestPositionsNextCursor) {
        await loadBacktestFactPage(
          backtestRun.id,
          "positions",
          {
            asOf: requestedAsOf || undefined,
            cursor: backtestPositionsNextCursor,
            append: true,
          },
          stillCurrent,
        );
      }
    } catch (error) {
      if (stillCurrent()) {
        setBacktestResultError(error instanceof Error ? error.message : String(error));
      }
    } finally {
      if (requestGeneration === factRequestGenerationRef.current) {
        setIsLoadingMoreFacts(false);
      }
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
                    disabled={isSaving || !selectedStrategy || !currentVersion}
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
              <div className="backtest-table-scroll">
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
              </div>
            </section>
          ) : null}

          {activeTab === "alerts" ? (
            <section className="strategy-panel" aria-label="告警事件">
              <h2>告警事件</h2>
              <div className="backtest-table-scroll">
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
              </div>
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
                          {formatBeijingDate(item.startDate)} 至{" "}
                          {formatBeijingDate(item.endDate)}
                        </small>
                        <small>
                          {item.status === "completed"
                            ? `收益 ${formatPercentMetric(item.metrics?.totalReturn)}`
                            : `进度 ${item.progressPercent.toFixed(0)}%`}
                        </small>
                      </button>
                    ))}
                    {backtestRuns.length === 0 ? (
                      <p className="strategy-muted">尚无组合回测运行。</p>
                    ) : null}
                    {backtestRunsNextCursor ? (
                      <button
                        disabled={isLoadingMoreBacktests}
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
                              disabled={isCancellingBacktest}
                              onClick={cancelBacktest}
                              type="button"
                            >
                              取消回测
                            </button>
                          ) : null}
                        </div>
                      </div>
                      {backtestCancelError ? (
                        <p className="strategy-error" role="alert">
                          {backtestCancelError}
                        </p>
                      ) : null}

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
                        <span>
                          价格模型：
                          {formatSnapshotString(backtestRun.configSnapshot, "priceModel")}
                        </span>
                        ；{formatBacktestAssumptions(backtestRun.configSnapshot)}
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
                      {backtestEquityError ? (
                        <p className="strategy-error">{backtestEquityError}</p>
                      ) : null}

                      {backtestDetailTab === "trades" ? (
                        <>
                          <div className="backtest-table-scroll">
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
                          </div>
                          {backtestTrades.length === 0 ? (
                            <p className="strategy-muted">暂无交易结果。</p>
                          ) : null}
                        </>
                      ) : null}

                      {backtestDetailTab === "orders" ? (
                        <>
                          <div className="backtest-table-scroll">
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
                                    <td>
                                      {formatDateTime(
                                        item.executionTime ?? item.expiredAt
                                      )}
                                    </td>
                                    <td>{item.quantity}</td>
                                    <td>{item.reason ?? "-"}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          {backtestOrders.length === 0 ? (
                            <p className="strategy-muted">暂无订单结果。</p>
                          ) : null}
                        </>
                      ) : null}

                      {backtestDetailTab === "signals" ? (
                        <>
                          <div className="backtest-table-scroll">
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
                          </div>
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
                                value={positionAsOfDraft}
                                onChange={(event) =>
                                  setPositionAsOfDraft(event.target.value)
                                }
                              />
                            </label>
                            <button
                              disabled={isLoadingMoreFacts}
                              onClick={refreshBacktestPositions}
                              type="button"
                            >
                              查询持仓
                            </button>
                          </div>
                          <div className="backtest-table-scroll">
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
                          </div>
                          {backtestPositions.length === 0 ? (
                            <p className="strategy-muted">该时点暂无持仓。</p>
                          ) : null}
                        </>
                      ) : null}

                      {backtestDetailTab === "snapshot" ? (
                        <div className="backtest-snapshots">
                          <p className="strategy-muted">
                            行情指纹：
                            {backtestRun.marketDataFingerprint
                              ? backtestRun.marketDataFingerprint.slice(0, 16) +
                                "…"
                              : "未记录"}
                            （算法：
                            {formatSnapshotString(
                              backtestRun.configSnapshot,
                              "marketDataFingerprintAlgorithm",
                            )}
                            ）。用于检测重跑时持久化 K 数据是否漂移，非可重放的数据快照。
                          </p>
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
                        </div>
                      ) : null}

                      {activeFactNextCursor ? (
                        <button
                          disabled={isLoadingMoreFacts}
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
                        type="number"
                        min="1"
                        step="1"
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
                        readOnly
                        aria-readonly="true"
                        value="日线 1440"
                      />
                    </label>
                    <label>
                      来源
                      <select
                        disabled={backtestSourceOptions.length === 0}
                        value={backtestSource}
                        onChange={(event) =>
                          setBacktestSource(
                            event.target.value as StrategyBacktestSourceValue
                          )
                        }
                      >
                        {backtestSourceOptions.map((source) => (
                          <option key={source} value={source}>
                            {source}
                          </option>
                        ))}
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
                      <input type="number" min="0" max={MAX_BACKTEST_CNY} step="0.01" value={backtestInitialCash} onChange={(event) => setBacktestInitialCash(event.target.value)} />
                    </label>
                    <label>
                      最大持仓
                      <input type="number" min="1" max="50" step="1" value={backtestMaxPositions} onChange={(event) => setBacktestMaxPositions(event.target.value)} />
                    </label>
                    <label>
                      滑点 bps
                      <input type="number" min="0" max="10000" step="0.01" value={backtestSlippageBps} onChange={(event) => setBacktestSlippageBps(event.target.value)} />
                    </label>
                    <label>
                      基准代码
                      <input value={backtestBenchmarkCode} onChange={(event) => setBacktestBenchmarkCode(event.target.value)} />
                    </label>
                  </div>
                  <div className="strategy-editor-row">
                    <label>
                      佣金率
                      <input type="number" min="0" max="1" step="0.0001" value={backtestCommissionRate} onChange={(event) => setBacktestCommissionRate(event.target.value)} />
                    </label>
                    <label>
                      最低佣金
                      <input type="number" min="0" max={MAX_BACKTEST_CNY} step="0.01" value={backtestMinCommission} onChange={(event) => setBacktestMinCommission(event.target.value)} />
                    </label>
                    <label>
                      印花税率
                      <input type="number" min="0" max="1" step="0.0001" value={backtestStampDutyRate} onChange={(event) => setBacktestStampDutyRate(event.target.value)} />
                    </label>
                    <label>
                      过户费率
                      <input type="number" min="0" max="1" step="0.00001" value={backtestTransferFeeRate} onChange={(event) => setBacktestTransferFeeRate(event.target.value)} />
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
