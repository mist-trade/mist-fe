import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import StrategiesPage from "../page";
import {
  acknowledgeStrategyAlertEvent,
  createStrategyBacktest,
  createStrategyDefinition,
  disableStrategyDefinition,
  enableStrategyDefinition,
  fetchStrategyAlertEvents,
  fetchStrategyBacktestSignals,
  fetchStrategySignals,
  listStrategies,
  listStrategyVersions,
  runStrategyScan,
  updateStrategyDefinition,
} from "@/app/api/client";

jest.mock("@/app/api/client", () => ({
  acknowledgeStrategyAlertEvent: jest.fn(),
  createStrategyBacktest: jest.fn(),
  createStrategyDefinition: jest.fn(),
  disableStrategyDefinition: jest.fn(),
  enableStrategyDefinition: jest.fn(),
  fetchStrategyAlertEvents: jest.fn(),
  fetchStrategyBacktestSignals: jest.fn(),
  fetchStrategySignals: jest.fn(),
  listStrategies: jest.fn(),
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
const mockedFetchStrategyBacktestSignals = fetchStrategyBacktestSignals as jest.Mock;

const strategy = {
  id: 3,
  name: "突破策略",
  description: "收盘价突破阈值",
  status: "enabled",
  targetUniverse: ["600519", "000001"],
  periods: [1440],
  sources: ["tdx"],
  currentVersionId: 5,
  updateTime: "2026-07-07T10:00:00.000Z",
};

const version = {
  id: 5,
  strategyDefinitionId: 3,
  versionNumber: 2,
  ruleSchemaVersion: "v1",
  rule: { field: "k.close", operator: "gt", value: 100 },
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
  ruleSnapshot: version.rule,
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
  signalCount: 2,
  matchedSecurityCount: 1,
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
  ruleSnapshot: version.rule,
  contextSnapshot: { k: { close: 121 } },
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
  mockedFetchStrategyBacktestSignals.mockResolvedValue([backtestSignal]);
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
    expect(screen.getByRole("tab", { name: "信号回测" })).toBeInTheDocument();
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
    fireEvent.change(screen.getByLabelText("规则 JSON"), {
      target: { value: "{ bad" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存策略" }));

    expect(await screen.findByText("规则 JSON 格式错误")).toBeInTheDocument();
    expect(mockedCreateStrategyDefinition).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("规则 JSON"), {
      target: { value: JSON.stringify({ field: "k.close", operator: "bogus", value: 100 }) },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存策略" }));

    expect(await screen.findByText("Unsupported operator")).toBeInTheDocument();
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

  it("creates signal-level backtests and renders aggregate signal rows", async () => {
    render(<StrategiesPage />);
    await screen.findByRole("heading", { name: "突破策略" });

    fireEvent.click(screen.getByRole("tab", { name: "信号回测" }));
    fireEvent.change(screen.getByLabelText("回测版本 ID"), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText("回测证券"), { target: { value: "600519" } });
    fireEvent.change(screen.getByLabelText("开始日期"), { target: { value: "2026-01-01" } });
    fireEvent.change(screen.getByLabelText("结束日期"), { target: { value: "2026-06-30" } });
    fireEvent.click(screen.getByRole("button", { name: "运行回测" }));

    expect(await screen.findByText("命中信号 2")).toBeInTheDocument();
    expect(screen.getByText("命中证券 1")).toBeInTheDocument();
    expect(screen.getByText("600519")).toBeInTheDocument();
    expect(mockedCreateStrategyBacktest).toHaveBeenCalledWith(
      expect.objectContaining({
        strategyVersionId: 5,
        targetUniverse: ["600519"],
        period: 1440,
        source: "tdx",
      })
    );
  });

  it("does not render portfolio simulation fields", async () => {
    render(<StrategiesPage />);
    await screen.findByRole("heading", { name: "突破策略" });

    const page = screen.getByRole("main");
    expect(within(page).queryByText("资金")).not.toBeInTheDocument();
    expect(within(page).queryByText("仓位")).not.toBeInTheDocument();
    expect(within(page).queryByText("订单")).not.toBeInTheDocument();
    expect(within(page).queryByText("滑点")).not.toBeInTheDocument();
    expect(within(page).queryByText("收益曲线")).not.toBeInTheDocument();
  });
});
