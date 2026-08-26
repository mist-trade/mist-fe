import { fireEvent, render, screen } from "@testing-library/react";
import { BacktestConfigPanel } from "../components/BacktestConfigPanel";
import type { StrategyDefinition, StrategyVersion } from "@/app/api/client";

describe("BacktestConfigPanel", () => {
  const mockStrategies: StrategyDefinition[] = [
    {
      id: 1,
      name: "缠论卖点策略",
      description: "5分钟缠论卖点",
      status: "enabled",
      targetUniverse: ["000001"],
      periods: [5],
      sources: ["tdx"],
      currentVersionId: 10,
      updatedAt: "2026-08-26T00:00:00.000Z",
    },
  ];

  const mockVersions: StrategyVersion[] = [
    {
      id: 10,
      strategyDefinitionId: 1,
      versionNumber: 1,
      ruleSchemaVersion: "v1",
      rule: { kind: "CHAN_BSP" },
      signalKind: "exit",
      validationSummary: { valid: true },
      createdAt: "2026-08-26T00:00:00.000Z",
    },
  ];

  it("renders form inputs with defaults", () => {
    render(
      <BacktestConfigPanel
        strategies={mockStrategies}
        versions={mockVersions}
        selectedStrategyId={1}
        onSelectStrategyId={jest.fn()}
        isRunning={false}
        onSubmit={jest.fn()}
      />
    );

    expect(screen.getByRole("heading", { name: "发起回测任务" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("000001")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "发起回测" })).toBeInTheDocument();
  });

  it("validates empty target code and displays error", () => {
    const handleSubmit = jest.fn();
    render(
      <BacktestConfigPanel
        strategies={mockStrategies}
        versions={mockVersions}
        selectedStrategyId={1}
        onSelectStrategyId={jest.fn()}
        isRunning={false}
        onSubmit={handleSubmit}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("如 000001, 600519"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "发起回测" }));

    expect(screen.getByText("请输入标的代码（如 000001）")).toBeInTheDocument();
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it("submits valid parameters down to seconds precision", () => {
    const handleSubmit = jest.fn();
    render(
      <BacktestConfigPanel
        strategies={mockStrategies}
        versions={mockVersions}
        selectedStrategyId={1}
        onSelectStrategyId={jest.fn()}
        isRunning={false}
        onSubmit={handleSubmit}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "发起回测" }));

    expect(handleSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        strategyVersionId: 10,
        targetUniverse: ["000001"],
        period: 5,
        source: "tdx",
        startDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        endDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      })
    );
  });
});
