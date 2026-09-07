import { act } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import StrategiesPage from "../page";
import {
  acknowledgeStrategyAlertEvent,
  createStrategyDefinition,
  disableStrategyDefinition,
  enableStrategyDefinition,
  fetchFactorPlugins,
  fetchStrategyAlertEvents,
  fetchStrategySignals,
  listStrategies,
  listStrategyVersions,
  type StrategyDefinitionPayload,
} from "@/app/api/client";

jest.mock("@/app/api/client", () => ({
  acknowledgeStrategyAlertEvent: jest.fn(),
  createStrategyDefinition: jest.fn(),
  disableStrategyDefinition: jest.fn(),
  enableStrategyDefinition: jest.fn(),
  fetchFactorPlugins: jest.fn(),
  fetchStrategyAlertEvents: jest.fn(),
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
const mockedFetchFactorPlugins = fetchFactorPlugins as jest.Mock;

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
  rule: {
    id: "guard_safety",
    type: "GUARD",
    name: "财务安全防线",
  },
  signalKind: "entry" as const,
  validationSummary: { valid: true },
  createdAt: "2026-07-07T09:00:00.000Z",
};

const signal = {
  id: 7,
  strategyDefinitionId: 3,
  strategyVersionId: 5,
  securityId: 17,
  security: { id: 17, code: "600519", name: "贵州茅台" },
  period: 1440,
  source: "tdx",
  signalTime: "2026-07-07T09:30:00.000Z",
  signalSource: "live",
  signalKind: "entry",
  confidence: 88.5,
  confidenceLevel: "HIGH",
  decisionTrace: {
    totalScore: 88.5,
    summary: "放量突破且外资加仓综合达标",
    trace: [
      {
        nodeId: "consensus_factors",
        name: "多因子加权共识打分",
        type: "CONSENSUS",
        score: 88.5,
        action: "BUY",
        reason: "放量突破20日高点",
      },
    ],
  },
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

const mockPlugins = [
  {
    id: "plugin.chan.bsp",
    name: "缠论买卖点因子",
    category: "chan_core",
    description: "基于宽笔/特征序列线段/笔中枢的一二三类买卖点",
    version: "1.0.0",
    supportedActions: ["BUY", "SELL"],
  },
  {
    id: "plugin.technical.volume-breakout",
    name: "放量突破因子",
    category: "momentum",
    description: "K线收盘价突破近期高点且成交量放大",
    version: "1.0.0",
    supportedActions: ["BUY", "SELL"],
  },
];

function setupMocks() {
  mockedListStrategies.mockResolvedValue([strategy]);
  mockedListStrategyVersions.mockResolvedValue([version]);
  mockedFetchStrategySignals.mockResolvedValue([signal]);
  mockedFetchStrategyAlertEvents.mockResolvedValue([alert]);
  mockedAcknowledgeStrategyAlertEvent.mockResolvedValue({ ...alert, status: "acked" });
  mockedCreateStrategyDefinition.mockResolvedValue(strategy);
  mockedEnableStrategyDefinition.mockResolvedValue({ ...strategy, status: "enabled" });
  mockedDisableStrategyDefinition.mockResolvedValue({ ...strategy, status: "disabled" });
  mockedFetchFactorPlugins.mockResolvedValue(mockPlugins);
}

/**
 * Fill the creation form with the supplied fields and submit it.
 */
async function submitCreateForm(fields: {
  name?: string;
  targetUniverse?: string;
  signalKind?: "entry" | "exit";
}) {
  if (fields.name !== undefined) {
    fireEvent.change(await screen.findByPlaceholderText("如：双因子共识动量突破策略"), {
      target: { value: fields.name },
    });
  }
  if (fields.targetUniverse !== undefined) {
    fireEvent.change(screen.getByPlaceholderText("逗号分隔，如 600519, 000001"), {
      target: { value: fields.targetUniverse },
    });
  }
  if (fields.signalKind !== undefined) {
    fireEvent.change(screen.getByLabelText("信号类型"), {
      target: { value: fields.signalKind },
    });
  }
  fireEvent.click(screen.getByRole("button", { name: "创建策略" }));
}

function awaitCreateSettled() {
  return waitFor(() => {
    expect(mockedCreateStrategyDefinition).toHaveBeenCalledTimes(1);
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
    expect(screen.getByRole("tab", { name: "策略详情" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "因子插件货架" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "实时信号历史" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "告警事件" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "信号回测" })).not.toBeInTheDocument();
    expect(screen.queryByText(/hero|landing/i)).not.toBeInTheDocument();
  });

  it("loads strategy registry rows and selected strategy details", async () => {
    render(<StrategiesPage />);

    expect(await screen.findByRole("heading", { name: "突破策略" })).toBeInTheDocument();
    expect(screen.getAllByText("enabled").length).toBeGreaterThan(0);
    expect(screen.getAllByText("当前版本 #5").length).toBeGreaterThan(0);
    expect(screen.getByText("600519, 000001")).toBeInTheDocument();
  });

  it("shows the current version signal kind as read-only metadata", async () => {
    render(<StrategiesPage />);
    await screen.findByRole("heading", { name: "突破策略" });

    expect((await screen.findAllByText("entry")).length).toBeGreaterThan(0);
  });

  it("submits the create payload with a decision flow tree AST", async () => {
    render(<StrategiesPage />);
    await screen.findByRole("heading", { name: "突破策略" });

    await submitCreateForm({
      name: "新策略",
      targetUniverse: "600519",
      signalKind: "entry",
    });

    await waitFor(() => expect(mockedCreateStrategyDefinition).toHaveBeenCalledTimes(1));
    await awaitCreateSettled();
    const payload = mockedCreateStrategyDefinition.mock.calls[0][0] as StrategyDefinitionPayload;
    expect(payload.signalKind).toBe("entry");
    expect(payload.name).toBe("新策略");
    expect(payload.targetUniverse).toEqual(["600519"]);
    expect(payload.rule).toBeDefined();

    const rule = payload.rule as Record<string, unknown>;
    expect(rule.kind).toBe("decision_flow");
    expect((rule.rootNode as Record<string, unknown>).type).toBe("GUARD");
    expect(mockedListStrategies).toHaveBeenCalled();
  });

  it("can submit both entry and exit signal kinds", async () => {
    render(<StrategiesPage />);
    await screen.findByRole("heading", { name: "突破策略" });

    await submitCreateForm({
      name: "退出策略",
      targetUniverse: "600519",
      signalKind: "exit",
    });

    await waitFor(() => expect(mockedCreateStrategyDefinition).toHaveBeenCalledTimes(1));
    await awaitCreateSettled();
    expect(
      (mockedCreateStrategyDefinition.mock.calls[0][0] as StrategyDefinitionPayload).signalKind
    ).toBe("exit");
  });

  it("supports switching decision flow preset to Chan BSP", async () => {
    render(<StrategiesPage />);
    await screen.findByRole("heading", { name: "突破策略" });

    fireEvent.click(screen.getByRole("button", { name: "缠论买卖点树" }));

    await submitCreateForm({
      name: "缠论买卖点策略",
      targetUniverse: "600519",
      signalKind: "entry",
    });

    await waitFor(() => expect(mockedCreateStrategyDefinition).toHaveBeenCalledTimes(1));
    await awaitCreateSettled();
    const payload = mockedCreateStrategyDefinition.mock.calls[0][0] as StrategyDefinitionPayload;
    const rule = payload.rule as Record<string, unknown>;
    const rootNode = rule.rootNode as Record<string, unknown>;
    expect(rootNode.id).toBe("guard_chan_bsp");
    expect(rootNode.pluginId).toBe("plugin.chan.bsp");
  });

  it("disables create button when strategy name is empty", async () => {
    render(<StrategiesPage />);
    await screen.findByRole("heading", { name: "突破策略" });

    const createBtn = screen.getByRole("button", { name: "创建策略" });
    expect(createBtn).toBeDisabled();
  });

  it("shows the backend create error near the creation editor", async () => {
    mockedCreateStrategyDefinition.mockRejectedValueOnce(new Error("Unsupported operator"));
    render(<StrategiesPage />);
    await screen.findByRole("heading", { name: "突破策略" });

    fireEvent.change(await screen.findByPlaceholderText("如：双因子共识动量突破策略"), {
      target: { value: "新策略" },
    });
    fireEvent.change(screen.getByPlaceholderText("逗号分隔，如 600519, 000001"), {
      target: { value: "600519" },
    });
    fireEvent.change(screen.getByLabelText("信号类型"), { target: { value: "entry" } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "创建策略" }));
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
    expect(screen.queryByRole("button", { name: "保存策略" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "创建策略" })).toBeInTheDocument();
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

  it("renders canonical live signal identity, confidence badge, and opens white-box drawer", async () => {
    render(<StrategiesPage />);
    await screen.findByRole("heading", { name: "突破策略" });

    fireEvent.click(screen.getByRole("tab", { name: "实时信号历史" }));

    expect(await screen.findByText("600519")).toBeInTheDocument();
    expect(screen.getByText("贵州茅台")).toBeInTheDocument();
    expect(screen.getByText("HIGH 88.5%")).toBeInTheDocument();
    expect(screen.getByText("买入 (BUY)")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "白盒归因" }));

    expect(await screen.findByRole("dialog", { name: "白盒决策归因与轨迹诊断" })).toBeInTheDocument();
    expect(screen.getByText("放量突破且外资加仓综合达标")).toBeInTheDocument();
    expect(screen.getByText("放量突破20日高点")).toBeInTheDocument();
  });

  it("browses factor plugin catalog in the catalog tab", async () => {
    render(<StrategiesPage />);
    await screen.findByRole("heading", { name: "突破策略" });

    fireEvent.click(screen.getByRole("tab", { name: "因子插件货架" }));

    expect(await screen.findByText("缠论买卖点因子")).toBeInTheDocument();
    expect(screen.getByText("放量突破因子")).toBeInTheDocument();
    expect(screen.getByText("基于宽笔/特征序列线段/笔中枢的一二三类买卖点")).toBeInTheDocument();
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
