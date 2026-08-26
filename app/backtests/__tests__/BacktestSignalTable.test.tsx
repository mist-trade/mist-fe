import { fireEvent, render, screen } from "@testing-library/react";
import { BacktestSignalTable } from "../components/BacktestSignalTable";
import type { StrategyBacktestSignalResult } from "@/app/api/client";

describe("BacktestSignalTable", () => {
  const mockSignals: StrategyBacktestSignalResult[] = [
    {
      id: 1,
      backtestRunId: 10,
      securityCode: "000001",
      signalTime: "2026-08-26T14:45:00.000Z",
      contextSnapshot: {
        type: "first_sell",
        price: 3850.5,
      },
      ruleSnapshot: {},
    },
    {
      id: 2,
      backtestRunId: 10,
      securityCode: "000001",
      signalTime: "2026-08-26T10:15:00.000Z",
      contextSnapshot: {
        type: "first_buy",
        price: 3810.0,
      },
      ruleSnapshot: {},
    },
  ];

  it("renders empty message when no signals exist", () => {
    render(
      <BacktestSignalTable
        signals={[]}
        selectedSignalId={null}
        onSelectSignal={jest.fn()}
      />
    );

    expect(screen.getByText("当前回测任务未触发任何买卖点信号。")).toBeInTheDocument();
  });

  it("renders signal rows and triggers onSelectSignal upon row click", () => {
    const handleSelect = jest.fn();
    render(
      <BacktestSignalTable
        signals={mockSignals}
        selectedSignalId={1}
        onSelectSignal={handleSelect}
      />
    );

    expect(screen.getByText("命中信号列表")).toBeInTheDocument();
    expect(screen.getByText("1卖")).toBeInTheDocument();
    expect(screen.getByText("1买")).toBeInTheDocument();
    expect(screen.getByText("3850.50")).toBeInTheDocument();

    fireEvent.click(screen.getByText("3810.00"));
    expect(handleSelect).toHaveBeenCalledWith(mockSignals[1]);
  });
});
