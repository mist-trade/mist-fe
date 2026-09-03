import { render, screen, waitFor } from "@testing-library/react";
import DualTimeframeChanPage from "../DualTimeframeChanPage";
import { fetchK, fetchVisualCommands, fetchSecurities } from "@/app/api/client";

jest.mock("@/app/api/client", () => ({
  fetchK: jest.fn(),
  fetchVisualCommands: jest.fn(),
  fetchSecurities: jest.fn(),
}));

jest.mock("@/app/components/tv-chart/TradingViewChart", () => ({
  __esModule: true,
  TradingViewChart: ({ k, commands = [], biColor }: { k: unknown[]; commands: unknown[]; biColor?: string }) => (
    <div data-testid="tv-chart" data-bicolor={biColor}>
      K lines: {k.length} | commands: {commands.length}
    </div>
  ),
  default: ({ k, commands = [], biColor }: { k: unknown[]; commands: unknown[]; biColor?: string }) => (
    <div data-testid="tv-chart" data-bicolor={biColor}>
      K lines: {k.length} | commands: {commands.length}
    </div>
  ),
}));

const mockedFetchSecurities = fetchSecurities as jest.Mock;
const mockedFetchK = fetchK as jest.Mock;
const mockedFetchVisualCommands = fetchVisualCommands as jest.Mock;

describe("DualTimeframeChanPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedFetchSecurities.mockResolvedValue([
      { code: "000001", name: "平安银行", type: "stock", status: 1 },
    ]);
    mockedFetchK.mockResolvedValue([
      {
        id: 1,
        symbol: "000001",
        time: "2026-01-06T11:00:00.000Z",
        open: 4042.85,
        high: 4190.87,
        low: 4042.85,
        close: 4190.87,
        volume: 1000,
        amount: 5000,
      },
    ]);
    mockedFetchVisualCommands.mockResolvedValue({
      commands: [
        {
          id: "cmd-1",
          type: "line",
          layer: "chan_bi",
          startPrice: 4042.85,
          endPrice: 4190.87,
        },
      ],
    });
  });

  it("renders dual-timeframe headers and charts successfully", async () => {
    render(<DualTimeframeChanPage />);

    expect(screen.getByText("多周期缠论工作台")).toBeInTheDocument();
    expect(screen.getByText("30 分钟 K 线走势 · 大级别大局观")).toBeInTheDocument();
    expect(screen.getByText("5 分钟 K 线微观结构 · 次级别笔与笔中枢放大镜")).toBeInTheDocument();

    await waitFor(() => {
      const charts = screen.getAllByTestId("tv-chart");
      expect(charts).toHaveLength(2);
    });
  });
});
