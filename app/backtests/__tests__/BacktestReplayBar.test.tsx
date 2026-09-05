import { fireEvent, render, screen } from "@testing-library/react";
import { BacktestReplayBar, type BacktestReplayBarProps } from "../components/BacktestReplayBar";

const mockSignals = [
  {
    id: 101,
    backtestRunId: 88,
    securityCode: "000001",
    signalTime: "2026-08-26T10:00:00.000Z",
    contextSnapshot: { type: "first_buy", price: 10.5 },
    ruleSnapshot: {},
  },
  {
    id: 102,
    backtestRunId: 88,
    securityCode: "000001",
    signalTime: "2026-08-26T14:30:00.000Z",
    contextSnapshot: { type: "first_sell", price: 11.2 },
    ruleSnapshot: {},
  },
];

const mockCurrentBar = {
  id: 20,
  symbol: "000001",
  time: new Date("2026-08-26T10:00:00.000Z"),
  open: 10.2,
  close: 10.5,
  high: 10.6,
  low: 10.1,
  amount: 500000,
};

describe("BacktestReplayBar", () => {
  const defaultProps: BacktestReplayBarProps = {
    isReplayMode: true,
    onToggleReplayMode: jest.fn(),
    cursorIndex: 10,
    totalBars: 50,
    currentBar: mockCurrentBar,
    signalIndices: [
      { signal: mockSignals[0], index: 10 },
      { signal: mockSignals[1], index: 40 },
    ],
    onStepPrev: jest.fn(),
    onStepNext: jest.fn(),
    onJumpFirst: jest.fn(),
    onJumpLast: jest.fn(),
    onJumpPrevSignal: jest.fn(),
    onJumpNextSignal: jest.fn(),
    onSeek: jest.fn(),
    isPlaying: false,
    onTogglePlay: jest.fn(),
    playSpeed: 500,
    onChangeSpeed: jest.fn(),
    onOpenDiagnosis: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders replay mode buttons and active signal info", () => {
    render(<BacktestReplayBar {...defaultProps} />);

    expect(screen.getByText("🌐 全景视角")).toBeInTheDocument();
    expect(screen.getByText("⏮ 单步复盘模式")).toHaveClass("active");
    expect(screen.getByText("K线: 11 / 50")).toBeInTheDocument();
    expect(screen.getByText(/收盘: ¥10.50/)).toBeInTheDocument();
    expect(screen.getByText(/触发 1买/)).toBeInTheDocument();
  });

  it("calls onStepPrev and onStepNext when buttons clicked", () => {
    render(<BacktestReplayBar {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: "◀ 步退" }));
    expect(defaultProps.onStepPrev).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "步进 ▶" }));
    expect(defaultProps.onStepNext).toHaveBeenCalledTimes(1);
  });

  it("calls onJumpFirst and onJumpLast when endpoints clicked", () => {
    render(<BacktestReplayBar {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: "|◀ 起始" }));
    expect(defaultProps.onJumpFirst).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "终点 ▶|" }));
    expect(defaultProps.onJumpLast).toHaveBeenCalledTimes(1);
  });

  it("calls onJumpPrevSignal and onJumpNextSignal", () => {
    render(<BacktestReplayBar {...defaultProps} cursorIndex={20} />);

    fireEvent.click(screen.getByRole("button", { name: "⏮ 上一买卖点" }));
    expect(defaultProps.onJumpPrevSignal).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "下一买卖点 ⏭" }));
    expect(defaultProps.onJumpNextSignal).toHaveBeenCalledTimes(1);
  });

  it("disables prev/next signal buttons when at boundary", () => {
    render(<BacktestReplayBar {...defaultProps} cursorIndex={5} />);
    expect(screen.getByRole("button", { name: "⏮ 上一买卖点" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "下一买卖点 ⏭" })).not.toBeDisabled();
  });

  it("toggles play state and switches speed", () => {
    render(<BacktestReplayBar {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: "▶ 播放" }));
    expect(defaultProps.onTogglePlay).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "2.0x" }));
    expect(defaultProps.onChangeSpeed).toHaveBeenCalledWith(250);
  });

  it("triggers onSeek when slider value changes", () => {
    render(<BacktestReplayBar {...defaultProps} />);

    const slider = screen.getByLabelText("回测历史时间游标滑块");
    fireEvent.change(slider, { target: { value: "35" } });
    expect(defaultProps.onSeek).toHaveBeenCalledWith(35);
  });

  it("renders tip when in full horizon mode", () => {
    render(<BacktestReplayBar {...defaultProps} isReplayMode={false} />);

    expect(screen.getByText(/当前处于全局全景视角/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("⏮ 单步复盘模式"));
    expect(defaultProps.onToggleReplayMode).toHaveBeenCalledWith(true);
  });
});
