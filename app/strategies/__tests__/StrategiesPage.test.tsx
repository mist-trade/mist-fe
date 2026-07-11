import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import StrategiesPage from "../page";
import {
  acknowledgeStrategyAlertEvent,
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
} from "@/app/api/client";

jest.mock("@/app/api/client", () => ({
  acknowledgeStrategyAlertEvent: jest.fn(),
  cancelStrategyBacktest: jest.fn(),
  createStrategyBacktest: jest.fn(),
  createStrategyDefinition: jest.fn(),
  disableStrategyDefinition: jest.fn(),
  enableStrategyDefinition: jest.fn(),
  fetchStrategyAlertEvents: jest.fn(),
  fetchStrategyBacktestEquity: jest.fn(),
  fetchStrategyBacktestOrders: jest.fn(),
  fetchStrategyBacktestSignals: jest.fn(),
  fetchStrategyBacktestPositions: jest.fn(),
  fetchStrategyBacktestRun: jest.fn(),
  fetchStrategyBacktestTrades: jest.fn(),
  fetchStrategySignals: jest.fn(),
  listStrategies: jest.fn(),
  listStrategyBacktests: jest.fn(),
  listStrategyVersions: jest.fn(),
  runStrategyScan: jest.fn(),
  updateStrategyDefinition: jest.fn(),
}));

const mockedListStrategies = listStrategies as jest.Mock;
const mockedCreateStrategyDefinition = createStrategyDefinition as jest.Mock;
const mockedUpdateStrategyDefinition = updateStrategyDefinition as jest.Mock;
const mockedEnableStrategyDefinition = enableStrategyDefinition as jest.Mock;
const mockedDisableStrategyDefinition = disableStrategyDefinition as jest.Mock;
const mockedListStrategyVersions = listStrategyVersions as jest.Mock;
const mockedFetchStrategySignals = fetchStrategySignals as jest.Mock;
const mockedFetchStrategyAlertEvents = fetchStrategyAlertEvents as jest.Mock;
const mockedAcknowledgeStrategyAlertEvent = acknowledgeStrategyAlertEvent as jest.Mock;
const mockedRunStrategyScan = runStrategyScan as jest.Mock;
const mockedCreateStrategyBacktest = createStrategyBacktest as jest.Mock;
const mockedListStrategyBacktests = listStrategyBacktests as jest.Mock;
const mockedFetchStrategyBacktestRun = fetchStrategyBacktestRun as jest.Mock;
const mockedFetchStrategyBacktestEquity = fetchStrategyBacktestEquity as jest.Mock;
const mockedFetchStrategyBacktestSignals = fetchStrategyBacktestSignals as jest.Mock;
const mockedFetchStrategyBacktestOrders = fetchStrategyBacktestOrders as jest.Mock;
const mockedFetchStrategyBacktestTrades = fetchStrategyBacktestTrades as jest.Mock;
const mockedFetchStrategyBacktestPositions = fetchStrategyBacktestPositions as jest.Mock;

const strategy = {
  id: 3,
  name: "突破策略",
  description: "收盘价突破阈值",
  status: "enabled",
  targetUniverse: ["600519", "000001"],
  periods: [1440],
  sources: ["tdx"],
  currentVersionId: 5,
  backtestEnabled: true,
  updateTime: "2026-07-07T10:00:00.000Z",
};

const version = {
  id: 5,
  strategyDefinitionId: 3,
  versionNumber: 2,
  ruleSchemaVersion: "v1",
  entryRule: { field: "k.close", operator: "gt", value: 100 },
  exitRule: { field: "k.close", operator: "lt", value: 90 },
  lookbackBars: 1,
  validationSummary: { valid: true },
  createTime: "2026-07-07T09:00:00.000Z",
};

const signal = {
  id: 7,
  strategyDefinitionId: 3,
  strategyVersionId: 5,
  securityCode: "600519",
  period: 1440,
  source: "tdx",
  signalTime: "2026-07-07T09:30:00.000Z",
  signalSource: "live",
  signalKind: "entry",
  ruleSnapshot: version.entryRule,
  contextSnapshot: { k: { close: 120 } },
};

const alert = {
  id: 9,
  strategySignalId: 7,
  status: "pending",
  dedupeKey: "3:5:600519:1440:tdx:2026-07-07",
  createTime: "2026-07-07T09:31:00.000Z",
};

const backtestRun = {
  id: 11,
  strategyDefinitionId: 3,
  strategyVersionId: 5,
  targetUniverse: ["600519"],
  period: 1440,
  source: "tdx",
  startDate: "2026-01-01",
  endDate: "2026-06-30",
  status: "completed",
  stage: "finalizing",
  signalCount: 2,
  matchedSecurityCount: 1,
  processedWork: 4,
  totalWork: 4,
  progressPercent: 100,
  attemptCount: 1,
  metrics: { totalReturn: 0.1 },
  startedAt: "2026-07-07T10:10:00.000Z",
  completedAt: "2026-07-07T10:10:01.000Z",
};

const backtestSignal = {
  id: 12,
  backtestRunId: 11,
  strategyDefinitionId: 3,
  strategyVersionId: 5,
  securityCode: "600519",
  period: 1440,
  source: "tdx",
  signalTime: "2026-03-01T00:00:00.000Z",
  signalKind: "entry",
  ruleSnapshot: version.entryRule,
  contextSnapshot: { k: { close: 121 } },
};

const backtestTrade = {
  id: 13,
  backtestRunId: 11,
  securityCode: "600519",
  status: "closed",
  entryOrderId: 20,
  exitOrderId: 21,
  entryTime: "2026-03-02T00:00:00.000Z",
  exitTime: "2026-03-10T00:00:00.000Z",
  entryPrice: 120,
  exitPrice: 125,
  quantity: 100,
  entryFee: 5,
  exitFee: 5,
  realizedPnl: 490,
  holdingDays: 6,
};

function setupMocks() {
  mockedListStrategies.mockResolvedValue([strategy]);
  mockedListStrategyVersions.mockResolvedValue([version]);
  mockedFetchStrategySignals.mockResolvedValue([signal]);
  mockedFetchStrategyAlertEvents.mockResolvedValue([alert]);
  mockedAcknowledgeStrategyAlertEvent.mockResolvedValue({ ...alert, status: "acked" });
  mockedRunStrategyScan.mockResolvedValue({
    createdSignalCount: 1,
    createdAlertCount: 1,
    skippedDuplicateCount: 0,
  });
  mockedCreateStrategyDefinition.mockResolvedValue(strategy);
  mockedUpdateStrategyDefinition.mockResolvedValue({ ...strategy, name: "突破策略 v2" });
  mockedEnableStrategyDefinition.mockResolvedValue({ ...strategy, status: "enabled" });
  mockedDisableStrategyDefinition.mockResolvedValue({ ...strategy, status: "disabled" });
  mockedCreateStrategyBacktest.mockResolvedValue(backtestRun);
  mockedListStrategyBacktests.mockResolvedValue({
    items: [backtestRun],
    nextCursor: null,
  });
  mockedFetchStrategyBacktestRun.mockResolvedValue(backtestRun);
  mockedFetchStrategyBacktestEquity.mockResolvedValue([]);
  mockedFetchStrategyBacktestSignals.mockResolvedValue({
    items: [backtestSignal],
    nextCursor: null,
  });
  mockedFetchStrategyBacktestOrders.mockResolvedValue({ items: [], nextCursor: null });
  mockedFetchStrategyBacktestTrades.mockResolvedValue({ items: [], nextCursor: null });
  mockedFetchStrategyBacktestPositions.mockResolvedValue({ items: [], nextCursor: null });
}

describe("StrategiesPage", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    setupMocks();
  });

  it("renders an operator workspace instead of a landing page", async () => {
    render(<StrategiesPage />);

    expect(await screen.findByRole("heading", { name: "策略工作台" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "策略库" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "信号历史" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "告警事件" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "组合回测" })).toBeInTheDocument();
    expect(screen.queryByText(/hero|landing/i)).not.toBeInTheDocument();
  });

  it("loads strategy registry rows and selected strategy details", async () => {
    render(<StrategiesPage />);

    expect(await screen.findByRole("heading", { name: "突破策略" })).toBeInTheDocument();
    expect(screen.getAllByText("enabled").length).toBeGreaterThan(0);
    expect(screen.getAllByText("当前版本 #5").length).toBeGreaterThan(0);
    expect(screen.getByText("600519, 000001")).toBeInTheDocument();
    expect(await screen.findByText("版本 2")).toBeInTheDocument();
  });

  it("blocks malformed rule JSON and shows backend validation errors", async () => {
    mockedCreateStrategyDefinition.mockRejectedValueOnce(new Error("Unsupported operator"));
    render(<StrategiesPage />);

    fireEvent.change(await screen.findByLabelText("策略名称"), {
      target: { value: "新策略" },
    });
    fireEvent.change(screen.getByLabelText("目标证券"), {
      target: { value: "600519" },
    });
    fireEvent.change(screen.getByLabelText("入场规则 JSON"), {
      target: { value: "{ bad" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存策略" }));

    expect(await screen.findByText("入场规则 JSON 格式错误")).toBeInTheDocument();
    expect(mockedCreateStrategyDefinition).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("入场规则 JSON"), {
      target: { value: JSON.stringify({ field: "k.close", operator: "bogus", value: 100 }) },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存策略" }));

    expect(await screen.findByText("Unsupported operator")).toBeInTheDocument();
  });

  it("edits paired V1 rules and exposes an independent backtest switch", async () => {
    render(<StrategiesPage />);

    expect(await screen.findByLabelText("入场规则 JSON")).toBeInTheDocument();
    expect(screen.getByLabelText("出场规则 JSON")).toBeInTheDocument();
    expect(screen.getByLabelText("回测开关")).toBeInTheDocument();
  });

  it("uses qmt rather than the stale mqmt source value for backtests", async () => {
    render(<StrategiesPage />);
    await screen.findByRole("heading", { name: "突破策略" });

    fireEvent.click(screen.getByRole("tab", { name: "组合回测" }));
    fireEvent.click(await screen.findByRole("button", { name: "新建组合回测" }));

    expect(screen.getByRole("option", { name: "qmt" })).toHaveValue("qmt");
    expect(screen.queryByRole("option", { name: "mqmt" })).not.toBeInTheDocument();
    await screen.findByText("阶段 finalizing");
  });

  it("runs strategy lifecycle, alert acknowledgement, and manual scan actions", async () => {
    render(<StrategiesPage />);
    await screen.findByRole("heading", { name: "突破策略" });

    fireEvent.click(screen.getByRole("button", { name: "停用" }));
    await waitFor(() => expect(mockedDisableStrategyDefinition).toHaveBeenCalledWith(3));

    fireEvent.click(screen.getByRole("button", { name: "启用" }));
    await waitFor(() => expect(mockedEnableStrategyDefinition).toHaveBeenCalledWith(3));

    fireEvent.click(screen.getByRole("tab", { name: "告警事件" }));
    fireEvent.click(await screen.findByRole("button", { name: "确认告警" }));
    await waitFor(() => expect(mockedAcknowledgeStrategyAlertEvent).toHaveBeenCalledWith(9));

    fireEvent.click(screen.getByRole("button", { name: "运行扫描" }));
    expect(await screen.findByText("新增信号 1 / 新增告警 1 / 跳过重复 0")).toBeInTheDocument();
  });

  it("creates asynchronous portfolio backtests and selects the returned pending run", async () => {
    render(<StrategiesPage />);
    await screen.findByRole("heading", { name: "突破策略" });

    fireEvent.click(screen.getByRole("tab", { name: "组合回测" }));
    fireEvent.click(await screen.findByRole("button", { name: "新建组合回测" }));
    fireEvent.change(screen.getByLabelText("回测版本 ID"), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText("回测证券"), { target: { value: "600519" } });
    fireEvent.change(screen.getByLabelText("开始日期"), { target: { value: "2026-01-01" } });
    fireEvent.change(screen.getByLabelText("结束日期"), { target: { value: "2026-06-30" } });
    fireEvent.click(screen.getByRole("button", { name: "提交组合回测" }));

    expect(await screen.findByText("运行 #11")).toBeInTheDocument();
    await screen.findByText("阶段 finalizing");
    expect(mockedCreateStrategyBacktest).toHaveBeenCalledWith(
      expect.objectContaining({
        strategyDefinitionId: 3,
        strategyVersionId: 5,
        targetUniverse: ["600519"],
        period: 1440,
        source: "tdx",
      })
    );
  });

  it("keeps the backtest drawer open and surfaces API validation errors", async () => {
    mockedCreateStrategyBacktest.mockRejectedValueOnce(
      new Error("BACKTEST_REQUEST_INVALID: benchmarkCode")
    );
    render(<StrategiesPage />);
    await screen.findByRole("heading", { name: "突破策略" });

    fireEvent.click(screen.getByRole("tab", { name: "组合回测" }));
    fireEvent.click(await screen.findByRole("button", { name: "新建组合回测" }));
    fireEvent.click(screen.getByRole("button", { name: "提交组合回测" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "BACKTEST_REQUEST_INVALID: benchmarkCode"
    );
    expect(screen.getByRole("dialog", { name: "新建组合回测" })).toBeInTheDocument();
  });

  it("renders portfolio simulation fields in the selected run detail", async () => {
    render(<StrategiesPage />);
    await screen.findByRole("heading", { name: "突破策略" });

    fireEvent.click(screen.getByRole("tab", { name: "组合回测" }));
    expect(await screen.findByText("阶段 finalizing")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "订单" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "持仓" })).toBeInTheDocument();
    expect(screen.getByText("年化波动")).toBeInTheDocument();
    expect(screen.getByText("平均仓位")).toBeInTheDocument();
    for (const label of [
      "总收益",
      "年化收益",
      "年化波动",
      "夏普比率",
      "最大回撤",
      "Calmar",
      "基准收益",
      "超额收益",
      "胜率",
      "盈亏比",
      "交易数",
      "平均持有",
      "换手率",
      "平均仓位",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("keeps history selection while filtering and following a run cursor", async () => {
    const laterRun = { ...backtestRun, id: 12, status: "failed" as const };
    mockedListStrategyBacktests
      .mockResolvedValueOnce({ items: [backtestRun], nextCursor: "run-cursor" })
      .mockResolvedValueOnce({ items: [laterRun], nextCursor: null });
    render(<StrategiesPage />);
    await screen.findByRole("heading", { name: "突破策略" });

    fireEvent.click(screen.getByRole("tab", { name: "组合回测" }));
    await screen.findByText("阶段 finalizing");
    fireEvent.click(await screen.findByRole("button", { name: "加载更多运行" }));

    await waitFor(() =>
      expect(mockedListStrategyBacktests).toHaveBeenLastCalledWith(
        expect.objectContaining({ cursor: "run-cursor", limit: 50 })
      )
    );
    expect(await screen.findByText("运行 #12")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("回测状态筛选"), {
      target: { value: "completed" },
    });
    await waitFor(() =>
      expect(mockedListStrategyBacktests).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: "completed", limit: 50 })
      )
    );

    fireEvent.click(screen.getByRole("button", { name: "新建组合回测" }));
    expect(screen.getByRole("heading", { name: "运行 #11" })).toBeInTheDocument();
  });

  it("loads only the active result tab", async () => {
    render(<StrategiesPage />);
    await screen.findByRole("heading", { name: "突破策略" });

    fireEvent.click(screen.getByRole("tab", { name: "组合回测" }));
    await screen.findByText("阶段 finalizing");
    await waitFor(() => expect(mockedFetchStrategyBacktestTrades).toHaveBeenCalled());
    expect(mockedFetchStrategyBacktestOrders).not.toHaveBeenCalled();
    expect(mockedFetchStrategyBacktestSignals).not.toHaveBeenCalled();
    expect(mockedFetchStrategyBacktestPositions).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("tab", { name: "订单" }));
    await waitFor(() => expect(mockedFetchStrategyBacktestOrders).toHaveBeenCalled());
  });

  it("disables a new portfolio run with a concrete eligibility reason", async () => {
    mockedListStrategies.mockResolvedValue([
      { ...strategy, backtestEnabled: false },
    ]);
    render(<StrategiesPage />);
    await screen.findByRole("heading", { name: "突破策略" });

    fireEvent.click(screen.getByRole("tab", { name: "组合回测" }));
    await screen.findByText("阶段 finalizing");
    fireEvent.click(await screen.findByRole("button", { name: "新建组合回测" }));

    expect(
      screen.getByText("该策略尚未开启回测资格，请先在策略编辑器中开启回测开关。")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "提交组合回测" })).toBeDisabled();
  });

  it("polls a selected non-terminal run and stops when leaving the backtest tab", async () => {
    jest.useFakeTimers();
    try {
      mockedFetchStrategyBacktestRun.mockResolvedValue({
        ...backtestRun,
        status: "running",
        stage: "simulating",
        completedAt: null,
      });
      render(<StrategiesPage />);
      await screen.findByRole("heading", { name: "突破策略" });

      fireEvent.click(screen.getByRole("tab", { name: "组合回测" }));
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(mockedFetchStrategyBacktestRun).toHaveBeenCalledTimes(1);

      await act(async () => {
        await jest.advanceTimersByTimeAsync(3_000);
      });
      expect(mockedFetchStrategyBacktestRun).toHaveBeenCalledTimes(2);

      fireEvent.click(screen.getByRole("tab", { name: "策略详情" }));
      const callCountAfterLeave = mockedFetchStrategyBacktestRun.mock.calls.length;
      await act(async () => {
        await jest.advanceTimersByTimeAsync(6_000);
      });
      expect(mockedFetchStrategyBacktestRun).toHaveBeenCalledTimes(callCountAfterLeave);
    } finally {
      jest.useRealTimers();
    }
  });

  it("follows fact cursors and supports as-of position reconstruction", async () => {
    mockedFetchStrategyBacktestTrades
      .mockResolvedValueOnce({ items: [backtestTrade], nextCursor: "trade-cursor" })
      .mockResolvedValueOnce({ items: [], nextCursor: null });
    render(<StrategiesPage />);
    await screen.findByRole("heading", { name: "突破策略" });

    fireEvent.click(screen.getByRole("tab", { name: "组合回测" }));
    expect(await screen.findByText("阶段 finalizing")).toBeInTheDocument();
    expect(await screen.findByText("490")).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "加载更多结果" }));
    await waitFor(() =>
      expect(mockedFetchStrategyBacktestTrades).toHaveBeenLastCalledWith(
        11,
        expect.objectContaining({ cursor: "trade-cursor", limit: 100 })
      )
    );

    fireEvent.click(screen.getByRole("tab", { name: "持仓" }));
    fireEvent.change(await screen.findByLabelText("持仓截止日期"), {
      target: { value: "2026-03-05" },
    });
    fireEvent.click(screen.getByRole("button", { name: "查询持仓" }));
    await waitFor(() =>
      expect(mockedFetchStrategyBacktestPositions).toHaveBeenLastCalledWith(
        11,
        expect.objectContaining({ asOf: "2026-03-05", limit: 100 })
      )
    );
  });

  it("surfaces structured run errors in the dedicated result tab", async () => {
    mockedFetchStrategyBacktestRun.mockResolvedValue({
      ...backtestRun,
      status: "failed",
      errorCode: "BACKTEST_DATA_COVERAGE_MISSING",
      errorMessage: "Missing persisted K data",
      errorDetails: { missingCodes: ["000300"] },
    });
    render(<StrategiesPage />);
    await screen.findByRole("heading", { name: "突破策略" });

    fireEvent.click(screen.getByRole("tab", { name: "组合回测" }));
    await screen.findByText("阶段 finalizing");
    fireEvent.click(screen.getByRole("tab", { name: "错误" }));

    expect(await screen.findByText(/BACKTEST_DATA_COVERAGE_MISSING/)).toBeInTheDocument();
    expect(screen.getByText(/000300/)).toBeInTheDocument();
  });
});
