import {
  toBacktestSignalResult,
  convertBacktestSignalsToCommands,
  convertReplaySignalsToCommands,
} from "../utils/backtest-signal-visual.util";
import type { StrategyBacktestSignalResult, SimulationSignalVo } from "@/app/api/client";
import type { IFetchK } from "@/app/api/types";

describe("backtest-signal-visual.util", () => {
  const mockSafeK: IFetchK[] = [
    {
      id: 1,
      symbol: "000001",
      time: "2026-08-26T09:30:00.000Z",
      open: 10,
      high: 11,
      low: 9.5,
      close: 10.5,
    },
    {
      id: 2,
      symbol: "000001",
      time: "2026-08-26T10:00:00.000Z",
      open: 10.5,
      high: 12,
      low: 10,
      close: 11.8,
    },
  ];

  it("converts SimulationSignalVo to StrategyBacktestSignalResult", () => {
    const simSig: SimulationSignalVo = {
      signalTime: "2026-08-26T10:00:00.000Z",
      triggerTime: "2026-08-26T10:00:00.000Z",
      pivotTime: "2026-08-26T09:30:00.000Z",
      triggerPrice: 11.8,
      pivotPrice: 9.5,
      signalType: "first_buy",
      badgeText: "1买",
      isBuy: true,
      confidence: 0.95,
      decisionTrace: { action: "BUY" },
      securityCode: "000001",
      period: 30,
    };

    const res = toBacktestSignalResult(simSig, 42);
    expect(res.id).toBe(42);
    expect(res.securityCode).toBe("000001");
    expect(res.signalTime).toBe("2026-08-26T10:00:00.000Z");
    expect(res.contextSnapshot.type).toBe("first_buy");
    expect(res.contextSnapshot.action).toBe("BUY");
    expect(res.contextSnapshot.triggerPrice).toBe(11.8);
    expect(res.contextSnapshot.pivotPrice).toBe(9.5);
    expect(res.contextSnapshot.triggerTime).toBe("2026-08-26T10:00:00.000Z");
    expect(res.contextSnapshot.pivotTime).toBe("2026-08-26T09:30:00.000Z");
  });

  it("converts StrategyBacktestSignalResult to visual commands with dual-timestamp anchoring", () => {
    const signals: StrategyBacktestSignalResult[] = [
      {
        id: 1,
        backtestRunId: 88,
        securityCode: "000001",
        signalTime: "2026-08-26T10:00:00.000Z",
        signalType: "first_buy",
        contextSnapshot: {
          type: "first_buy",
          action: "BUY",
          pivotTime: "2026-08-26T09:30:00.000Z",
          pivotPrice: 9.5,
          triggerPrice: 11.8,
        },
        ruleSnapshot: {},
        createdAt: "2026-08-26T10:00:00.000Z",
      },
      {
        id: 2,
        backtestRunId: 88,
        securityCode: "000001",
        signalTime: "2026-08-26T10:00:00.000Z",
        signalType: "second_sell",
        contextSnapshot: {
          type: "second_sell",
          action: "SELL",
          pivotPrice: 12.0,
          triggerPrice: 11.8,
        },
        ruleSnapshot: {},
        createdAt: "2026-08-26T10:00:00.000Z",
      },
    ];

    const commands = convertBacktestSignalsToCommands(signals, mockSafeK);
    expect(commands).toHaveLength(2);

    // 1买: pivotTime (09:30) is within K-line range, so it anchors at pivotTime
    expect(commands[0].id).toBe("backtest_sig_1");
    expect(commands[0].time).toBe("2026-08-26T09:30:00.000Z");
    expect(commands[0].text).toBe("1买");
    expect(commands[0].position).toBe("below");
    expect(commands[0].color).toBe("#EF4444");
    expect(commands[0].price).toBe(9.5);

    // 2卖: no pivotTime in contextSnapshot, falls back to signalTime (10:00)
    expect(commands[1].id).toBe("backtest_sig_2");
    expect(commands[1].time).toBe("2026-08-26T10:00:00.000Z");
    expect(commands[1].text).toBe("2卖");
    expect(commands[1].position).toBe("above");
    expect(commands[1].color).toBe("#22C55E");
    expect(commands[1].price).toBe(12.0);
  });

  it("converts replay signals to commands filtering out out-of-range times", () => {
    const minTimeMs = new Date("2026-08-26T09:30:00.000Z").getTime();
    const replaySignals: SimulationSignalVo[] = [
      {
        signalTime: "2026-08-26T09:00:00.000Z",
        triggerPrice: 10,
        signalType: "first_buy",
        badgeText: "1买",
        isBuy: true,
        confidence: 1,
        decisionTrace: null,
        securityCode: "000001",
        period: 30,
      },
      {
        signalTime: "2026-08-26T10:00:00.000Z",
        pivotTime: "2026-08-26T09:30:00.000Z",
        triggerPrice: 11.5,
        pivotPrice: 9.8,
        signalType: "third_buy",
        badgeText: "3买",
        isBuy: true,
        confidence: 1,
        decisionTrace: null,
        securityCode: "000001",
        period: 30,
      },
    ];

    const commands = convertReplaySignalsToCommands(replaySignals, minTimeMs);
    // The first signal has time 09:00 which is < minTimeMs (09:30), so it is filtered out
    expect(commands).toHaveLength(1);
    expect(commands[0].id).toBe("replay_sig_1_third_buy");
    expect(commands[0].text).toBe("3买");
    expect(commands[0].time).toBe("2026-08-26T09:30:00.000Z");
    expect(commands[0].price).toBe(9.8);
  });
});
