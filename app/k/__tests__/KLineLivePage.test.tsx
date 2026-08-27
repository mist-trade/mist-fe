import { fireEvent, render, screen } from "@testing-library/react";
import KLineLivePage from "../KLineLivePage";
import {
  collectKLines,
  fetchK,
  fetchVisualCommands,
  fetchSecurities,
} from "@/app/api/client";


jest.mock("@/app/api/client", () => ({
  collectKLines: jest.fn(),
  fetchK: jest.fn(),
  fetchVisualCommands: jest.fn(),
  fetchSecurities: jest.fn(),
}));

jest.mock("@/app/components/tv-chart/TradingViewChart", () => ({
  __esModule: true,
  default: ({ k }: { k: unknown[] }) => (
    <div data-testid="tv-chart">K lines: {k.length}</div>
  ),
}));

const mockedFetchSecurities = fetchSecurities as jest.Mock;
const mockedFetchK = fetchK as jest.Mock;
const mockedFetchVisualCommands = fetchVisualCommands as jest.Mock;
const mockedCollectKLines = collectKLines as jest.Mock;
const originalEnv = process.env;

const securities = [
  { code: "600519", name: "贵州茅台", type: "stock", status: 1 },
  { code: "000001", name: "平安银行", type: "stock", status: 1 },
];

const kLines = [
  {
    id: 1,
    symbol: "600519",
    time: "2026-06-30T00:00:00.000Z",
    amount: 1000,
    open: 1,
    close: 2,
    high: 3,
    low: 0.5,
    volume: 100,
    period: 1440,
    source: "tdx",
    createdAt: "2026-06-30T00:00:00.000Z",
    updatedAt: "2026-06-30T00:00:00.000Z",
  },
];

describe("KLineLivePage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.history.pushState(null, "", "/k");
    mockedFetchSecurities.mockResolvedValue(securities);
    mockedFetchK.mockResolvedValue(kLines);
    mockedFetchVisualCommands.mockResolvedValue({ commands: [] });
    mockedCollectKLines.mockResolvedValue({ code: "600519", period: 1440, count: 1 });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("renders with securities and keeps chart empty when no query", async () => {
    render(<KLineLivePage />);

    expect(screen.getByRole("heading", { name: "K 线工作台" })).toBeInTheDocument();
    expect(await screen.findByText("选择股票后加载 K 线")).toBeInTheDocument();
    expect(mockedFetchK).not.toHaveBeenCalled();
    expect(screen.queryByTestId("tv-chart")).not.toBeInTheDocument();
  });

  it("filters securities and selects code from list", async () => {
    render(<KLineLivePage />);

    const searchInput = screen.getByPlaceholderText("搜索代码或名称");
    fireEvent.change(searchInput, { target: { value: "茅台" } });

    const option = await screen.findByRole("button", { name: "600519 贵州茅台" });
    fireEvent.click(option);

    expect(window.location.search).toContain("code=600519");
    expect(await screen.findByTestId("tv-chart")).toHaveTextContent("K lines: 1");
  });

  it("loads chart on URL params and updates state", async () => {
    window.history.pushState(
      null,
      "",
      "/k?code=600519&source=tdx&period=1440&startDate=2026-01-01&endDate=2026-06-30"
    );

    render(<KLineLivePage />);

    expect(await screen.findByText("贵州茅台")).toBeInTheDocument();
    expect(mockedFetchK).toHaveBeenCalledWith({
      code: "600519",
      source: "tdx",
      period: 1440,
      startDate: "2026-01-01",
      endDate: "2026-06-30",
    });

    expect(await screen.findByTestId("tv-chart")).toHaveTextContent("K lines: 1");
  });

  it("handles empty K lines gracefully", async () => {
    mockedFetchK.mockResolvedValueOnce([]);

    window.history.pushState(
      null,
      "",
      "/k?code=600519&source=tdx&period=1440&startDate=2026-01-01&endDate=2026-06-30"
    );

    render(<KLineLivePage />);

    expect(await screen.findAllByText("当前查询没有 K 线数据")).toHaveLength(2);
    expect(screen.queryByTestId("tv-chart")).not.toBeInTheDocument();
  });


  it("refreshes klines when clicking primary action", async () => {
    window.history.pushState(
      null,
      "",
      "/k?code=600519&source=tdx&period=1440&startDate=2026-01-01&endDate=2026-06-30"
    );

    render(<KLineLivePage />);
    await screen.findByTestId("tv-chart");

    fireEvent.click(screen.getByRole("button", { name: "刷新 K 线" }));

    expect(await screen.findByText("已刷新 1 条 K 线")).toBeInTheDocument();
    expect(mockedCollectKLines).toHaveBeenCalledWith({
      code: "600519",
      source: "tdx",
      period: 1440,
      startDate: "2026-01-01",
      endDate: "2026-06-30",
    });
  });
});
