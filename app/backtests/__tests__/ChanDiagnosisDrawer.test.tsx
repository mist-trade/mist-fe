import { fireEvent, render, screen } from "@testing-library/react";
import { ChanDiagnosisDrawer } from "../components/ChanDiagnosisDrawer";
import type { StrategyBacktestSignalResult } from "@/app/api/client";

describe("ChanDiagnosisDrawer", () => {
  const mockSignal: StrategyBacktestSignalResult = {
    id: 101,
    backtestRunId: 12,
    securityCode: "000001",
    signalTime: "2026-08-26T14:45:00.000Z",
    contextSnapshot: {
      type: "first_sell",
      price: 3850.5,
      zg: 3880.2,
      zd: 3820.0,
      gg: 3900.0,
      dd: 3800.0,
      zhongshuIndex: 3,
    },
    ruleSnapshot: {
      kind: "CHAN_BSP",
      bspTypes: ["first_sell", "second_sell", "third_sell"],
    },
  };

  it("does not render when signal is null", () => {
    const { container } = render(<ChanDiagnosisDrawer signal={null} onClose={jest.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders Chan geometry parameters and definition for first_sell", () => {
    const handleClose = jest.fn();
    render(<ChanDiagnosisDrawer signal={mockSignal} onClose={handleClose} />);

    expect(screen.getByText("第一类卖点 (1卖)")).toBeInTheDocument();
    expect(screen.getByText("标的代码：000001")).toBeInTheDocument();
    expect(screen.getByText("3880.20")).toBeInTheDocument(); // ZG
    expect(screen.getByText("3820.00")).toBeInTheDocument(); // ZD
    expect(screen.getByText(/公共重叠有效/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "✕" }));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("handles non-central second_buy signal gracefully", () => {
    const secondBuySignal: StrategyBacktestSignalResult = {
      id: 102,
      backtestRunId: 12,
      securityCode: "000001",
      signalTime: "2026-08-26T15:00:00.000Z",
      contextSnapshot: {
        type: "second_buy",
        price: 3830.0,
      },
      ruleSnapshot: {},
    };

    render(<ChanDiagnosisDrawer signal={secondBuySignal} onClose={jest.fn()} />);

    expect(screen.getByText("第二类买点 (2买)")).toBeInTheDocument();
    expect(screen.getByText("该信号为二类点或非中枢离开点，未关联单一中枢区间。")).toBeInTheDocument();
  });
});
