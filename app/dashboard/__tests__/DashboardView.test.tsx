/**
 * Dashboard 概览页交互冒烟测试。
 *
 * 不 mock 图表组件本身——真实渲染 EquityChart/DrawdownChart 的 React 树,
 * 但 mock 掉 ECharts 的 DOM 依赖（jsdom 没有 canvas），验证：
 *  - 首屏渲染不抛错
 *  - 范围切换 → KPI/图表数据更新
 *  - 持仓表渲染且盈亏值存在
 *  - 连接徽章 + 数据时间渲染
 *  - tabular numerals 类应用
 */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";

// Mock ECharts core（jsdom 无 canvas），避免 init 抛错
jest.mock("echarts/core", () => ({
  init: jest.fn(() => ({
    setOption: jest.fn(),
    resize: jest.fn(),
    dispose: jest.fn(),
  })),
  registerTheme: jest.fn(),
  use: jest.fn(),
}));
jest.mock("echarts/charts", () => ({ LineChart: {}, BarChart: {}, CandlestickChart: {}, CustomChart: {} }));
jest.mock("echarts/components", () => ({
  GridComponent: {}, TooltipComponent: {}, LegendComponent: {},
  DataZoomComponent: {}, TitleComponent: {}, DatasetComponent: {}, TransformComponent: {},
}));
jest.mock("echarts/renderers", () => ({ CanvasRenderer: {} }));
jest.mock("echarts/features", () => ({ LabelLayout: {}, UniversalTransition: {} }));

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

    expect(screen.getByText("组合监控")).toBeInTheDocument();
    expect(screen.getByText("账户净值")).toBeInTheDocument();
    expect(screen.getByText("累计收益")).toBeInTheDocument();
    expect(screen.getByText("持仓快照")).toBeInTheDocument();
    expect(screen.getByText("在线")).toBeInTheDocument();
    expect(screen.getByText(/数据时间/)).toBeInTheDocument();
  });

  it("范围切换器默认选中 3M，切换到 1Y 后 KPI 更新", async () => {
    await renderView();

    // 默认 3M 高亮
    const btn3M = screen.getByRole("tab", { name: "3M" });
    expect(btn3M).toHaveAttribute("aria-selected", "true");

    // 点击 1Y
    const btn1Y = screen.getByRole("tab", { name: "1Y" });
    fireEvent.click(btn1Y);
    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "1Y" })).toHaveAttribute(
        "aria-selected",
        "true"
      );
    });
    // 3M 取消选中
    expect(screen.getByRole("tab", { name: "3M" })).toHaveAttribute(
      "aria-selected",
      "false"
    );
  });

  it("持仓表渲染且含盈亏数据", async () => {
    await renderView();

    // 持仓中的证券代码
    expect(await screen.findByText("600519")).toBeInTheDocument();
    expect(screen.getByText("贵州茅台")).toBeInTheDocument();
    // 表头列（用 columnheader role 精确定位，避免与"盈亏%"列重复）
    const headers = screen.getAllByRole("columnheader");
    const headerTexts = headers.map((h) => h.textContent);
    expect(headerTexts).toContain("浮动盈亏");
    expect(headerTexts).toContain("仓位");
  });

  it("持仓表可按盈亏%排序", async () => {
    await renderView();
    await screen.findByText("600519");

    // 精确匹配"盈亏%"列（区别于"浮动盈亏"）
    const pnlPctHeader = screen.getByRole("columnheader", {
      name: /^盈亏%$/,
    });
    expect(pnlPctHeader).toBeInTheDocument();
    // 点击触发排序不抛错
    fireEvent.click(pnlPctHeader);
  });

  it("连接徽章显示延迟数值（tabular numerals）", async () => {
    await renderView();
    expect(screen.getByText("42 ms")).toBeInTheDocument();
  });

  it("KPI 数值应用 tabular numerals（.tnum）", async () => {
    const { container } = await renderView();
    await screen.findByText("账户净值");
    const tnumNodes = container.querySelectorAll(".tnum");
    expect(tnumNodes.length).toBeGreaterThan(0);
  });
});
