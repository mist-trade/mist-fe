import { render, screen, fireEvent } from "@testing-library/react";

import { SWRConfig } from "swr";

// Mock TradingViewLineChart（jsdom 无 canvas）
jest.mock("@/app/components/tv-chart/TradingViewLineChart", () => ({
  __esModule: true,
  default: () => <div data-testid="tv-line-chart" />,
  TradingViewLineChart: () => <div data-testid="tv-line-chart" />,
}));

// Mock useConnectionStatus，避免探测真实网络
jest.mock("@/app/lib/swr/useConnectionStatus", () => ({
  useConnectionStatus: () => ({
    state: "online",
    latencyMs: 42,
    lastUpdated: "2026-07-22T15:30:00+08:00",
    timezone: "Asia/Shanghai",
  }),
}));

// 动态导入，让 jest 处理 next/dynamic
async function renderView() {
  const { DashboardView } = await import("../components/DashboardView");
  const utils = render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <DashboardView />
    </SWRConfig>
  );
  return utils;
}

describe("Dashboard 概览页", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("渲染所有关键区块不抛错", async () => {
    await renderView();

    expect(screen.getByRole("heading", { name: "组合监控" })).toBeInTheDocument();
    expect(screen.getByRole("tablist", { name: "时间范围" })).toBeInTheDocument();
    expect(screen.getByText("账户净值")).toBeInTheDocument();
    expect(screen.getByText("持仓快照")).toBeInTheDocument();
  });

  it("切换时间范围触发数据更新", async () => {
    await renderView();

    const rangeTab = screen.getByRole("tab", { name: "1M" });
    fireEvent.click(rangeTab);

    expect(rangeTab).toHaveAttribute("aria-selected", "true");
  });

  it("持仓表渲染且标的列可见", async () => {
    await renderView();

    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("贵州茅台")).toBeInTheDocument();
    expect(screen.getByText("宁德时代")).toBeInTheDocument();
  });

  it("连接状态徽章渲染且在线", async () => {
    await renderView();

    expect(screen.getByText("在线")).toBeInTheDocument();
    expect(screen.getByText(/42\s*ms/)).toBeInTheDocument();
  });
});
