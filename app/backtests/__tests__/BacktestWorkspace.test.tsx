import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { BacktestWorkspace } from "../BacktestWorkspace";
import {
  createStrategyBacktest,
  fetchK,
  fetchVisualCommands,
  fetchStrategyBacktestRun,
  fetchStrategyBacktestSignals,
  listStrategies,
  listStrategyVersions,
} from "@/app/api/client";

jest.mock("@/app/api/client", () => ({
  createStrategyBacktest: jest.fn(),
  fetchK: jest.fn(),
  fetchVisualCommands: jest.fn(),
  fetchStrategyBacktestRun: jest.fn(),
  fetchStrategyBacktestSignals: jest.fn(),
  listStrategies: jest.fn(),
  listStrategyVersions: jest.fn(),
  isLocalDevEnvironment: jest.fn(() => true),
  startSimulation: jest.fn(),
  controlSimulation: jest.fn(),
  stopSimulation: jest.fn(),
  getSimulationStreamUrl: jest.fn(),
  fetchSimulationDump: jest.fn(),
}));

// Mock dynamic TradingViewChart
jest.mock("@/app/components/tv-chart/TradingViewChart", () => {
  return function MockTradingViewChart(props: { k: unknown[]; commands?: unknown[] }) {
    return (
      <div data-testid="mock-tv-chart">
        <span>Mock TradingViewChart loaded with {props.k?.length || 0} bars</span>
      </div>
    );
  };
});

const mockStrategy = {
  id: 1,
  name: "缠论5分钟卖点策略",
  description: "检测5分钟趋势背驰一类二类三类卖点",
  status: "enabled",
  targetUniverse: ["000001"],
  periods: [5],
  sources: ["tdx"],
  currentVersionId: 10,
  updatedAt: "2026-08-26T00:00:00.000Z",
};

const mockVersion = {
  id: 10,
  strategyDefinitionId: 1,
  versionNumber: 1,
  ruleSchemaVersion: "v1",
  rule: { kind: "CHAN_BSP" },
  signalKind: "exit" as const,
  validationSummary: { valid: true },
  createdAt: "2026-08-26T00:00:00.000Z",
};

const mockBacktestRunPending = {
  id: 88,
  strategyDefinitionId: 1,
  strategyVersionId: 10,
  targetUniverse: ["000001"],
  period: 5,
  source: "tdx",
  startDate: "2026-08-26T09:30:00.000Z",
  endDate: "2026-08-26T15:00:00.000Z",
  status: "running" as const,
  signalCount: 0,
  matchedSecurityCount: 0,
  startedAt: "2026-08-26T17:00:00.000Z",
};

const mockBacktestRunCompleted = {
  ...mockBacktestRunPending,
  status: "completed" as const,
  signalCount: 1,
  matchedSecurityCount: 1,
  completedAt: "2026-08-26T17:00:02.000Z",
};

const mockBacktestSignals = [
  {
    id: 999,
    backtestRunId: 88,
    securityCode: "000001",
    signalTime: "2026-08-26T14:45:00.000Z",
    contextSnapshot: {
      type: "first_sell",
      price: 3850.5,
      zg: 3880.0,
      zd: 3820.0,
      gg: 3900.0,
      dd: 3800.0,
    },
    ruleSnapshot: { kind: "CHAN_BSP" },
  },
];

const mockK = [
  {
    id: 1,
    symbol: "000001",
    time: new Date("2026-08-26T14:45:00.000Z"),
    open: 3840,
    close: 3850,
    high: 3855,
    low: 3835,
    amount: 100000,
  },
];

describe("BacktestWorkspace", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (listStrategies as jest.Mock).mockResolvedValue([mockStrategy]);
    (listStrategyVersions as jest.Mock).mockResolvedValue([mockVersion]);
    (createStrategyBacktest as jest.Mock).mockResolvedValue({
      runId: 88,
      initialStatus: "PENDING",
    });
    (fetchStrategyBacktestRun as jest.Mock)
      .mockResolvedValueOnce(mockBacktestRunPending)
      .mockResolvedValue(mockBacktestRunCompleted);
    (fetchStrategyBacktestSignals as jest.Mock).mockResolvedValue(mockBacktestSignals);
    (fetchK as jest.Mock).mockResolvedValue(mockK);
    (fetchVisualCommands as jest.Mock).mockResolvedValue({ commands: [] });
  });

  it("renders backtest workspace layout and form elements", async () => {
    render(<BacktestWorkspace />);

    expect(await screen.findByRole("heading", { name: "回测工作台" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "发起回测任务" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "发起回测" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "收起侧栏" })).toBeInTheDocument();
  });

  it("submits a backtest task, polls for completion, and renders chart and signals", async () => {
    render(<BacktestWorkspace />);

    await screen.findByRole("heading", { name: "发起回测任务" });
    await screen.findByText(/版本 v1/);
    fireEvent.click(screen.getByRole("button", { name: "发起回测" }));

    // Verify submission
    await waitFor(() => {
      expect(createStrategyBacktest).toHaveBeenCalledTimes(1);
    });

    // Wait for completed poll and chart load
    expect(await screen.findByTestId("mock-tv-chart")).toBeInTheDocument();
    expect(screen.getByText(/Mock TradingViewChart loaded with 1 bars/)).toBeInTheDocument();

    // Verify signal table row
    expect(screen.getByText("1卖")).toBeInTheDocument();
    expect(screen.getByText("3850.50")).toBeInTheDocument();
  });


  it("opens DecisionTraceDrawer when clicking a signal in table", async () => {
    render(<BacktestWorkspace />);

    await screen.findByRole("heading", { name: "发起回测任务" });
    await screen.findByText(/版本 v1/);
    fireEvent.click(screen.getByRole("button", { name: "发起回测" }));

    await screen.findByTestId("mock-tv-chart");

    // Click "诊断 & 定位" in signal table
    fireEvent.click(screen.getByRole("button", { name: "诊断 & 定位" }));

    expect(await screen.findByRole("dialog", { name: "白盒决策归因与轨迹诊断" })).toBeInTheDocument();

    // Close drawer
    fireEvent.click(screen.getByRole("button", { name: "✕" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "白盒决策归因与轨迹诊断" })).not.toBeInTheDocument();
    });
  });

  it("supports single-step replay mode toggle and stepping", async () => {
    render(<BacktestWorkspace />);

    await screen.findByRole("heading", { name: "发起回测任务" });
    await screen.findByText(/版本 v1/);
    fireEvent.click(screen.getByRole("button", { name: "发起回测" }));

    await screen.findByTestId("mock-tv-chart");

    // Replay bar should be rendered
    expect(screen.getByText("🌐 全景视角")).toBeInTheDocument();
    expect(screen.getByText("⏮ 单步复盘模式")).toBeInTheDocument();

    // Toggle to replay mode
    fireEvent.click(screen.getByText("⏮ 单步复盘模式"));

    // Step buttons should be visible
    expect(screen.getByRole("button", { name: "◀ 步退" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "步进 ▶" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "▶ 播放" })).toBeInTheDocument();

    // Clicking a signal in table enters replay mode and focuses on it
    fireEvent.click(screen.getByRole("button", { name: "诊断 & 定位" }));
    expect(await screen.findByRole("dialog", { name: "白盒决策归因与轨迹诊断" })).toBeInTheDocument();
  });

  it("renders layer toggle controls and filters commands accordingly", async () => {
    (fetchVisualCommands as jest.Mock).mockResolvedValue({
      commands: [
        { id: "bi_1", type: "line", layer: "chan_bi" },
        { id: "zs_bi_1", type: "band", layer: "chan_zs_bi" },
        { id: "duan_1", type: "line", layer: "chan_duan" },
        { id: "zs_duan_1", type: "band", layer: "chan_zs_duan" },
        { id: "bsp_1", type: "text", layer: "chan_bsp", text: "1买" },
      ],
    });

    render(<BacktestWorkspace />);

    await screen.findByRole("heading", { name: "发起回测任务" });
    await screen.findByText(/版本 v1/);
    fireEvent.click(screen.getByRole("button", { name: "发起回测" }));

    await screen.findByTestId("mock-tv-chart");

    // Check layer toggle buttons are present
    const biBtn = screen.getByRole("button", { name: /笔折线/ });
    const biZsBtn = screen.getByRole("button", { name: /笔中枢/ });
    const duanBtn = screen.getByRole("button", { name: /线段/ });
    const duanZsBtn = screen.getByRole("button", { name: /段中枢/ });
    const backtestSignalsBtn = screen.getByRole("button", { name: /回测买卖点/ });
    const chanBspBtn = screen.getByRole("button", { name: /原生买卖点/ });

    expect(biBtn).toHaveClass("active");
    expect(biZsBtn).toHaveClass("active");
    expect(duanBtn).not.toHaveClass("active");
    expect(duanZsBtn).not.toHaveClass("active");
    expect(backtestSignalsBtn).toHaveClass("active");
    expect(chanBspBtn).not.toHaveClass("active");

    // Toggle Duan ZS on
    fireEvent.click(duanZsBtn);
    expect(duanZsBtn).toHaveClass("active");

    // Toggle Bi ZS off
    fireEvent.click(biZsBtn);
    expect(biZsBtn).not.toHaveClass("active");
  });
});
