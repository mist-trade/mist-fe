import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { BacktestWorkspace } from "../BacktestWorkspace";
import {
  createStrategyBacktest,
  fetchBi,
  fetchChannel,
  fetchDuan,
  fetchDuanChannel,
  fetchFenxing,
  fetchK,
  fetchMergeK,
  fetchStrategyBacktestRun,
  fetchStrategyBacktestSignals,
  listStrategies,
  listStrategyVersions,
} from "@/app/api/client";

jest.mock("@/app/api/client", () => ({
  createStrategyBacktest: jest.fn(),
  fetchBi: jest.fn(),
  fetchChannel: jest.fn(),
  fetchDuan: jest.fn(),
  fetchDuanChannel: jest.fn(),
  fetchFenxing: jest.fn(),
  fetchK: jest.fn(),
  fetchMergeK: jest.fn(),
  fetchStrategyBacktestRun: jest.fn(),
  fetchStrategyBacktestSignals: jest.fn(),
  listStrategies: jest.fn(),
  listStrategyVersions: jest.fn(),
}));

import type { KPanelProps } from "@/app/components/k-panel/types";

// Mock dynamic KPanel to avoid echarts canvas rendering in JSDOM
jest.mock("@/app/components/k-panel", () => {
  return function MockKPanel(props: KPanelProps) {
    return (
      <div data-testid="mock-k-panel">
        <span>Mock KPanel loaded with {props.k?.length || 0} bars</span>
        <button
          type="button"
          data-testid="mock-bsp-click"
          onClick={() =>
            props.onSignalClick?.({
              bspId: 0,
              index: 0,
              time: "2026-08-26",
              price: 3850,
              type: "first_sell",
              label: "1卖",
              isBuy: false,
              rawSignal: {
                id: 999,
                signalTime: "2026-08-26T14:45:00.000Z",
                securityCode: "000001",
                type: "first_sell",
                price: 3850,
                contextSnapshot: { zg: 3880, zd: 3820 },
              },
            })
          }
        >
          Click BSP Pin
        </button>
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
    (createStrategyBacktest as jest.Mock).mockResolvedValue(mockBacktestRunPending);
    (fetchStrategyBacktestRun as jest.Mock)
      .mockResolvedValueOnce(mockBacktestRunPending)
      .mockResolvedValue(mockBacktestRunCompleted);
    (fetchStrategyBacktestSignals as jest.Mock).mockResolvedValue(mockBacktestSignals);
    (fetchK as jest.Mock).mockResolvedValue(mockK);
    (fetchMergeK as jest.Mock).mockResolvedValue([]);
    (fetchBi as jest.Mock).mockResolvedValue({ phaseA: [], phaseB: [] });
    (fetchFenxing as jest.Mock).mockResolvedValue([]);
    (fetchChannel as jest.Mock).mockResolvedValue({ phaseA: [], phaseB: [] });
    (fetchDuan as jest.Mock).mockResolvedValue([]);
    (fetchDuanChannel as jest.Mock).mockResolvedValue({ phaseA: [], phaseB: [] });
  });

  it("renders backtest workspace layout and form elements", async () => {
    render(<BacktestWorkspace />);

    expect(await screen.findByRole("heading", { name: "回测可视化工作台" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "发起回测任务" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "发起回测" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "K 线" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "回测" })).toHaveAttribute("aria-current", "page");
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
    expect(await screen.findByTestId("mock-k-panel")).toBeInTheDocument();
    expect(screen.getByText(/已加载 000001 的 1 根 K 线/)).toBeInTheDocument();

    // Verify signal table row
    expect(screen.getByText("1卖")).toBeInTheDocument();
    expect(screen.getByText("3850.50")).toBeInTheDocument();
  });

  it("opens ChanDiagnosisDrawer when clicking a signal or chart BSP pin", async () => {
    render(<BacktestWorkspace />);

    await screen.findByRole("heading", { name: "发起回测任务" });
    await screen.findByText(/版本 v1/);
    fireEvent.click(screen.getByRole("button", { name: "发起回测" }));

    await screen.findByTestId("mock-k-panel");

    // Click "诊断 & 定位" in signal table
    fireEvent.click(screen.getByRole("button", { name: "诊断 & 定位" }));

    expect(await screen.findByRole("dialog", { name: "缠论中枢与背驰诊断" })).toBeInTheDocument();
    expect(screen.getByText("第一类卖点 (1卖)")).toBeInTheDocument();

    // Close drawer
    fireEvent.click(screen.getByRole("button", { name: "✕" }));
    expect(screen.queryByRole("dialog", { name: "缠论中枢与背驰诊断" })).not.toBeInTheDocument();

    // Click BSP Pin inside mock chart
    fireEvent.click(screen.getByTestId("mock-bsp-click"));
    expect(await screen.findByRole("dialog", { name: "缠论中枢与背驰诊断" })).toBeInTheDocument();
  });

  it("toggles sub-chart between Volume and MACD momentum", async () => {
    render(<BacktestWorkspace />);

    await screen.findByRole("heading", { name: "发起回测任务" });
    await screen.findByText(/版本 v1/);
    fireEvent.click(screen.getByRole("button", { name: "发起回测" }));

    await screen.findByTestId("mock-k-panel");

    const macdBtn = screen.getByRole("button", { name: "MACD 力度" });
    const volumeBtn = screen.getByRole("button", { name: "成交量" });

    expect(volumeBtn).toHaveClass("active");
    expect(macdBtn).not.toHaveClass("active");

    fireEvent.click(macdBtn);
    expect(macdBtn).toHaveClass("active");
    expect(volumeBtn).not.toHaveClass("active");
  });
});
