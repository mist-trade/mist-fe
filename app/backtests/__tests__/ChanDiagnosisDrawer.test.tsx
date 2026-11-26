import { fireEvent, render, screen } from "@testing-library/react";
import { DecisionTraceDrawer } from "@/app/components/DecisionTraceDrawer";
import type { StrategyBacktestSignalResult } from "@/app/api/client";

describe("DecisionTraceDrawer", () => {
  const mockSignal: StrategyBacktestSignalResult = {
    id: 101,
    backtestRunId: 12,
    securityCode: "000001",
    signalTime: "2026-08-26T14:45:00.000Z",
    decisionTrace: {
      summary: "缠论线段级一卖确认，趋势顶背驰转折",
      trace: [
        {
          nodeId: "guard_chan",
          type: "GUARD",
          name: "缠论结构门禁",
          action: "SELL",
          passed: true,
          reason: "一卖确认",
        },
        {
          nodeId: "term_sell",
          type: "TERMINAL",
          name: "终结输出",
          action: "SELL",
          reason: "发出卖出信号",
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

  it("renders whitebox summary and Chan geometry without confidence badge", () => {
    const handleClose = jest.fn();
    render(<DecisionTraceDrawer signal={mockSignal} onClose={handleClose} />);

    expect(screen.getByText("000001")).toBeInTheDocument();
    expect(screen.getByText("缠论线段级一卖确认，趋势顶背驰转折")).toBeInTheDocument();
    expect(screen.getByText("3880.20")).toBeInTheDocument(); // ZG
    expect(screen.getByText("3820.00")).toBeInTheDocument(); // ZD
    expect(screen.getByText("GUARD")).toBeInTheDocument();
    expect(screen.getByText("TERMINAL")).toBeInTheDocument();

    expect(screen.queryByText(/HIGH|MEDIUM|LOW/)).not.toBeInTheDocument();
    expect(screen.queryByText(/85\.0%|90\.0%/)).not.toBeInTheDocument();
    expect(screen.queryByText(/CONSENSUS|确信度|置信度/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "✕" }));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("renders EXTRACTOR and BRANCH execution trace nodes cleanly", () => {
    const branchSignal: StrategyBacktestSignalResult = {
      ...mockSignal,
      id: 102,
      decisionTrace: {
        summary: "资金提取并命中条件分支",
        trace: [
          {
            nodeId: "extract_capital",
            type: "EXTRACTOR",
            name: "资金流入提取",
            exportedKey: "capital.flow",
          },
          {
            nodeId: "branch_capital",
            type: "BRANCH",
            name: "阈值分流",
            conditionResult: true,
          },
        ],
      },
    };

    render(<DecisionTraceDrawer signal={branchSignal} onClose={jest.fn()} />);
    expect(screen.getByText("EXTRACTOR")).toBeInTheDocument();
    expect(screen.getByText("BRANCH")).toBeInTheDocument();
    expect(screen.getByText("capital.flow")).toBeInTheDocument();
    expect(screen.getByText(/True \(命中\)/)).toBeInTheDocument();
    expect(screen.queryByText(/CONSENSUS|确信度/)).not.toBeInTheDocument();
  });
});
