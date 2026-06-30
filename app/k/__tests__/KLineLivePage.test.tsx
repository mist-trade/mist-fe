import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import KLineLivePage from "../KLineLivePage";
import {
  collectKLines,
  fetchBi,
  fetchChannel,
  fetchFenxing,
  fetchK,
  fetchMergeK,
  fetchSecurities,
} from "@/app/api/client";

jest.mock("@/app/api/client", () => ({
  collectKLines: jest.fn(),
  fetchBi: jest.fn(),
  fetchChannel: jest.fn(),
  fetchFenxing: jest.fn(),
  fetchK: jest.fn(),
  fetchMergeK: jest.fn(),
  fetchSecurities: jest.fn(),
}));

jest.mock("@/app/components/k-panel", () => ({
  __esModule: true,
  default: ({ k }: { k: unknown[] }) => (
    <div data-testid="k-panel">K lines: {k.length}</div>
  ),
}));

const mockedFetchSecurities = fetchSecurities as jest.Mock;
const mockedFetchK = fetchK as jest.Mock;
const mockedFetchMergeK = fetchMergeK as jest.Mock;
const mockedFetchBi = fetchBi as jest.Mock;
const mockedFetchFenxing = fetchFenxing as jest.Mock;
const mockedFetchChannel = fetchChannel as jest.Mock;
const mockedCollectKLines = collectKLines as jest.Mock;

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
    highest: 3,
    lowest: 0.5,
  },
];

describe("KLineLivePage", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    window.history.replaceState(null, "", "/k");
    mockedFetchSecurities.mockResolvedValue(securities);
    mockedFetchK.mockResolvedValue(kLines);
    mockedFetchMergeK.mockResolvedValue([]);
    mockedFetchBi.mockResolvedValue([]);
    mockedFetchFenxing.mockResolvedValue([]);
    mockedFetchChannel.mockResolvedValue([]);
    mockedCollectKLines.mockResolvedValue({ code: "600519", period: 1440, count: 1 });
  });

  it("shows stock selection state without rendering fixture data when code is missing", async () => {
    render(<KLineLivePage />);

    expect(await screen.findByText("选择股票后加载 K 线")).toBeInTheDocument();
    expect(screen.queryByTestId("k-panel")).not.toBeInTheDocument();
    expect(mockedFetchK).not.toHaveBeenCalled();
  });

  it("filters securities by code or name and writes the selected code to the URL", async () => {
    render(<KLineLivePage />);

    fireEvent.change(await screen.findByPlaceholderText("搜索代码或名称"), {
      target: { value: "茅台" },
    });
    fireEvent.click(screen.getByRole("button", { name: /600519 贵州茅台/ }));

    await waitFor(() => {
      expect(window.location.search).toContain("code=600519");
    });
    expect(screen.getByDisplayValue("600519")).toBeInTheDocument();
  });

  it("loads live K-lines from URL-backed query parameters", async () => {
    window.history.replaceState(
      null,
      "",
      "/k?code=600519&source=tdx&period=1440&startDate=2026-01-01&endDate=2026-06-30"
    );

    render(<KLineLivePage />);

    expect(await screen.findByTestId("k-panel")).toHaveTextContent("K lines: 1");
    expect(mockedFetchK).toHaveBeenCalledWith({
      code: "600519",
      source: "tdx",
      period: 1440,
      startDate: "2026-01-01",
      endDate: "2026-06-30",
    });
    expect(mockedFetchMergeK).toHaveBeenCalledWith({
      code: "600519",
      source: "tdx",
      period: 1440,
      startDate: "2026-01-01",
      endDate: "2026-06-30",
    });
    expect(mockedFetchChannel).toHaveBeenCalledWith({
      code: "600519",
      source: "tdx",
      period: 1440,
      startDate: "2026-01-01",
      endDate: "2026-06-30",
    });
    expect(screen.getByDisplayValue("600519")).toBeInTheDocument();
  });

  it("blocks manual refresh until required parameters are selected", async () => {
    render(<KLineLivePage />);

    fireEvent.click(await screen.findByRole("button", { name: "刷新 K 线" }));

    expect(await screen.findByText("请选择股票")).toBeInTheDocument();
    expect(mockedCollectKLines).not.toHaveBeenCalled();
  });

  it("keeps refresh success feedback after reloading selected K-lines", async () => {
    window.history.replaceState(
      null,
      "",
      "/k?code=600519&source=tdx&period=1440&startDate=2026-01-01&endDate=2026-06-30"
    );

    render(<KLineLivePage />);
    await screen.findByTestId("k-panel");

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

  it("renders empty K-line responses without falling back to fixture data", async () => {
    mockedFetchK.mockResolvedValue([]);
    window.history.replaceState(
      null,
      "",
      "/k?code=600519&source=tdx&period=1440&startDate=2026-01-01&endDate=2026-06-30"
    );

    render(<KLineLivePage />);

    const chartArea = screen.getByLabelText("K 线图表");
    await waitFor(() => {
      expect(within(chartArea).getByText("当前查询没有 K 线数据")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("k-panel")).not.toBeInTheDocument();
  });

  it("shows stock loading errors without clearing URL-backed query state", async () => {
    mockedFetchSecurities.mockRejectedValue(new Error("stock service down"));
    window.history.replaceState(
      null,
      "",
      "/k?code=600519&source=tdx&period=1440&startDate=2026-01-01&endDate=2026-06-30"
    );

    render(<KLineLivePage />);

    expect(await screen.findByText("stock service down")).toBeInTheDocument();
    expect(window.location.search).toContain("code=600519");
    expect(await screen.findByTestId("k-panel")).toHaveTextContent("K lines: 1");
  });

  it("clears stale chart output when overlay requests fail", async () => {
    mockedFetchMergeK.mockRejectedValue(new Error("overlay failed"));
    window.history.replaceState(
      null,
      "",
      "/k?code=600519&source=tdx&period=1440&startDate=2026-01-01&endDate=2026-06-30"
    );

    render(<KLineLivePage />);

    expect(await screen.findByText("overlay failed")).toBeInTheDocument();
    expect(screen.queryByTestId("k-panel")).not.toBeInTheDocument();
  });
});
