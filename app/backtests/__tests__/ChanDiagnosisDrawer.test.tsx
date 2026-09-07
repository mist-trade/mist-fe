import { fireEvent, render, screen } from "@testing-library/react";
import { DecisionTraceDrawer } from "@/app/components/DecisionTraceDrawer";
import type { StrategyBacktestSignalResult } from "@/app/api/client";

describe("DecisionTraceDrawer", () => {
  const mockSignal: StrategyBacktestSignalResult = {
    id: 101,
    backtestRunId: 12,
    securityCode: "000001",
    signalTime: "2026-08-26T14:45:00.000Z",
    confidence: 90.0,
    confidenceLevel: "HIGH",
    decisionTrace: {
      summary: "缠论线段级一卖确认，趋势顶背驰转折",
      trace: [
        {
          nodeId: "guard_chan",
          type: "GUARD",
          name: "缠论结构门禁",
          action: "SELL",
          reason: "一卖确认",
        },
      ],
    },
    contextSnapshot: {
      type: "first_sell",
      price: 3850.5,
      zg: 3880.2,
      zd: 3820.0,
    },
    ruleSnapshot: {
      kind: "decision_flow",
    },
  };

  it("does not render when signal is null", () => {
    const { container } = render(<DecisionTraceDrawer signal={null} onClose={jest.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders confidence badge, whitebox summary, and Chan geometry", () => {
    const handleClose = jest.fn();
    render(<DecisionTraceDrawer signal={mockSignal} onClose={handleClose} />);

    expect(screen.getByText("000001")).toBeInTheDocument();
    expect(screen.getByText("HIGH 90.0%")).toBeInTheDocument();
    expect(screen.getByText("缠论线段级一卖确认，趋势顶背驰转折")).toBeInTheDocument();
    expect(screen.getByText("3880.20")).toBeInTheDocument(); // ZG
    expect(screen.getByText("3820.00")).toBeInTheDocument(); // ZD

    fireEvent.click(screen.getByRole("button", { name: "✕" }));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
