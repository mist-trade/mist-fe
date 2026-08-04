import { act } from "react";
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
  type StrategyDefinitionPayload,
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
}));

const mockedListStrategies = listStrategies as jest.Mock;
const mockedCreateStrategyDefinition = createStrategyDefinition as jest.Mock;
const mockedEnableStrategyDefinition = enableStrategyDefinition as jest.Mock;
const mockedDisableStrategyDefinition = disableStrategyDefinition as jest.Mock;
const mockedListStrategyVersions = listStrategyVersions as jest.Mock;
const mockedFetchStrategySignals = fetchStrategySignals as jest.Mock;
const mockedFetchStrategyAlertEvents = fetchStrategyAlertEvents as jest.Mock;
const mockedAcknowledgeStrategyAlertEvent = acknowledgeStrategyAlertEvent as jest.Mock;
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
  updatedAt: "2026-07-07T10:00:00.000Z",
};

const version = {
  id: 5,
  strategyDefinitionId: 3,
  versionNumber: 2,
  ruleSchemaVersion: "v1",
  rule: { field: "k.volume", operator: "gt", value: "100" },
  signalKind: "entry" as const,
  validationSummary: { valid: true },
  createdAt: "2026-07-07T09:00:00.000Z",
};

const signal = {
  id: 7,
  strategyDefinitionId: 3,
  strategyVersionId: 5,
  securityId: 17,
  period: 1440,
  source: "tdx",
  signalTime: "2026-07-07T09:30:00.000Z",
  signalSource: "live",
  signalKind: "entry",
  ruleSnapshot: version.rule,
  contextSnapshot: { k: { close: 120 } },
};

const alert = {
  id: 9,
  strategySignalId: 7,
  status: "pending",
  dedupeKey: "3:5:600519:1440:tdx:2026-07-07",
  createdAt: "2026-07-07T09:31:00.000Z",
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
  securityCode: "600519",
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
  mockedCreateStrategyDefinition.mockResolvedValue(strategy);
  mockedEnableStrategyDefinition.mockResolvedValue({ ...strategy, status: "enabled" });
  mockedDisableStrategyDefinition.mockResolvedValue({ ...strategy, status: "disabled" });
  mockedCreateStrategyBacktest.mockResolvedValue(backtestRun);
  mockedFetchStrategyBacktestSignals.mockResolvedValue([backtestSignal]);
}

/**
 * Fill the creation form with the supplied fields and submit it. The rule JSON
 * textarea is updated last so the caller controls the exact serialized shape.
 */
async function submitCreateForm(fields: {
  name?: string;
  targetUniverse?: string;
  ruleJson?: string;
  signalKind?: "entry" | "exit";
}) {
  if (fields.name !== undefined) {
    fireEvent.change(await screen.findByLabelText("策略名称"), {
      target: { value: fields.name },
    });
  }
  if (fields.targetUniverse !== undefined) {
    fireEvent.change(screen.getByLabelText("目标证券"), {
      target: { value: fields.targetUniverse },
    });
  }
  if (fields.signalKind !== undefined) {
    fireEvent.change(screen.getByLabelText("信号类型"), {
      target: { value: fields.signalKind },
    });
  }
  if (fields.ruleJson !== undefined) {
    fireEvent.change(screen.getByLabelText("规则 JSON"), {
      target: { value: fields.ruleJson },
    });
  }
  fireEvent.click(screen.getByRole("button", { name: "创建策略" }));
}

/**
 * Wait for the create-save cycle to fully settle: the create call resolves,
 * the registry is refreshed and the saving flag clears. Prevents pending async
 * state updates from leaking across tests.
 */
function awaitCreateSettled() {
  return waitFor(() => {
    expect(mockedCreateStrategyDefinition).toHaveBeenCalledTimes(1);
    // refreshStrategies runs after a successful create, so listStrategies is
    // invoked a second time once the save cycle is complete.
    expect(mockedListStrategies.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
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

  it("shows the current version signal kind as read-only metadata", async () => {
    render(<StrategiesPage />);
    await screen.findByRole("heading", { name: "突破策略" });

    // Signal kind is read from the real StrategyVersion contract, surfaced as a
    // read-only detail next to the selected strategy.
    expect(screen.getAllByText("entry").length).toBeGreaterThan(0);
  });

  it("submits the create payload with a required signal kind", async () => {
    render(<StrategiesPage />);
    await screen.findByRole("heading", { name: "突破策略" });

    await submitCreateForm({
      name: "新策略",
      targetUniverse: "600519",
      signalKind: "entry",
      ruleJson: JSON.stringify({
        field: "k.volume",
        operator: "gt",
        value: "100",
      }),
    });

    await waitFor(() => expect(mockedCreateStrategyDefinition).toHaveBeenCalledTimes(1));
    await awaitCreateSettled();
    const payload = mockedCreateStrategyDefinition.mock.calls[0][0] as StrategyDefinitionPayload;
    expect(payload.signalKind).toBe("entry");
    expect(payload.name).toBe("新策略");
    expect(payload.targetUniverse).toEqual(["600519"]);
    // The registry is refreshed after a successful creation.
    expect(mockedListStrategies).toHaveBeenCalled();
  });

  it("can submit both entry and exit signal kinds", async () => {
    render(<StrategiesPage />);
    await screen.findByRole("heading", { name: "突破策略" });

    await submitCreateForm({
      name: "退出策略",
      targetUniverse: "600519",
      signalKind: "exit",
      ruleJson: JSON.stringify({
        field: "k.close",
        operator: "lt",
        value: 10,
      }),
    });

    await waitFor(() => expect(mockedCreateStrategyDefinition).toHaveBeenCalledTimes(1));
    await awaitCreateSettled();
    expect(
      (mockedCreateStrategyDefinition.mock.calls[0][0] as StrategyDefinitionPayload).signalKind
    ).toBe("exit");
  });

  it("preserves a decimal-string threshold verbatim instead of coercing to a number", async () => {
    render(<StrategiesPage />);
    await screen.findByRole("heading", { name: "突破策略" });

    const decimalThreshold = "100.00000001";
    await submitCreateForm({
      name: "量额策略",
      targetUniverse: "600519",
      signalKind: "entry",
      ruleJson: JSON.stringify({
        field: "k.volume",
        operator: "gt",
        value: decimalThreshold,
      }),
    });

    await waitFor(() => expect(mockedCreateStrategyDefinition).toHaveBeenCalledTimes(1));
    await awaitCreateSettled();
    const payload = mockedCreateStrategyDefinition.mock.calls[0][0] as StrategyDefinitionPayload;
    // The threshold is forwarded as the exact canonical decimal string, not a
    // number and not a String(number) coercion.
    const rule = payload.rule as { value: unknown };
    expect(rule.value).toBe(decimalThreshold);
    expect(typeof rule.value).toBe("string");
  });

  it("blocks invalid rule JSON and shows the parse error without calling the API", async () => {
    render(<StrategiesPage />);
    await screen.findByRole("heading", { name: "突破策略" });

    await submitCreateForm({
      name: "新策略",
      targetUniverse: "600519",
      ruleJson: "{ bad",
    });

    expect(await screen.findByText("规则 JSON 格式错误")).toBeInTheDocument();
    expect(mockedCreateStrategyDefinition).not.toHaveBeenCalled();
  });

  it("shows the backend create error near the creation editor", async () => {
    mockedCreateStrategyDefinition.mockRejectedValueOnce(new Error("Unsupported operator"));
    render(<StrategiesPage />);
    await screen.findByRole("heading", { name: "突破策略" });

    // Fill the form fields first, then submit inside an async act so the
    // rejected create promise's catch/finally state updates are captured.
    fireEvent.change(screen.getByLabelText("策略名称"), { target: { value: "新策略" } });
    fireEvent.change(screen.getByLabelText("目标证券"), { target: { value: "600519" } });
    fireEvent.change(screen.getByLabelText("信号类型"), { target: { value: "entry" } });
    fireEvent.change(screen.getByLabelText("规则 JSON"), {
      target: {
        value: JSON.stringify({ field: "k.close", operator: "bogus", value: 100 }),
      },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "创建策略" }));
      // Let the rejected create promise settle so the catch/finally state
      // updates run inside this act scope.
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText("Unsupported operator")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "创建策略" })).not.toBeDisabled();
  });

  it("does not expose an update or save-content action for existing strategies", async () => {
    render(<StrategiesPage />);
    await screen.findByRole("heading", { name: "突破策略" });

    const page = screen.getByRole("main");
    expect(within(page).queryByRole("button", { name: "更新当前策略" })).not.toBeInTheDocument();
    // The only strategy submit action is the create button.
    expect(screen.queryByRole("button", { name: "保存策略" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "创建策略" })).toBeInTheDocument();
    // Creating never reaches the (removed) update consumer.
    await submitCreateForm({
      name: "新策略",
      targetUniverse: "600519",
      signalKind: "entry",
      ruleJson: JSON.stringify({ field: "k.close", operator: "gt", value: 100 }),
    });
    await awaitCreateSettled();
  });

  it("runs strategy lifecycle and alert acknowledgement actions", async () => {
    render(<StrategiesPage />);
    await screen.findByRole("heading", { name: "突破策略" });

    fireEvent.click(screen.getByRole("button", { name: "停用" }));
    await waitFor(() => expect(mockedDisableStrategyDefinition).toHaveBeenCalledWith(3));

    fireEvent.click(screen.getByRole("button", { name: "启用" }));
    await waitFor(() => expect(mockedEnableStrategyDefinition).toHaveBeenCalledWith(3));

    fireEvent.click(screen.getByRole("tab", { name: "告警事件" }));
    fireEvent.click(await screen.findByRole("button", { name: "确认告警" }));
    await waitFor(() => expect(mockedAcknowledgeStrategyAlertEvent).toHaveBeenCalledWith(9));
  });

  it("renders canonical live signal identity and signal kind", async () => {
    render(<StrategiesPage />);
    await screen.findByRole("heading", { name: "突破策略" });

    fireEvent.click(screen.getByRole("tab", { name: "信号历史" }));

    expect(await screen.findByText("17")).toBeInTheDocument();
    expect(screen.getByText("entry")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /扫描/ })).not.toBeInTheDocument();
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
