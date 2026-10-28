import type {
  StrategyBacktestSignalResult,
  VisualCommandVo,
  SimulationSignalVo,
} from "@/app/api/client";
import type { IFetchK } from "@/app/api/types";

/**
 * 将仿真推流实时到达的 SimulationSignalVo 转换为界面标准的 StrategyBacktestSignalResult
 */
export function toBacktestSignalResult(
  sig: SimulationSignalVo,
  id: number
): StrategyBacktestSignalResult {
  return {
    id,
    backtestRunId: 0,
    securityCode: sig.securityCode,
    signalTime: sig.signalTime,
    signalType: sig.signalType,
    badgeText: sig.badgeText,
    confidence: sig.confidence,
    confidenceLevel: "HIGH",
    decisionTrace: sig.decisionTrace,
    contextSnapshot: {
      type: sig.signalType,
      action: sig.isBuy ? "BUY" : "SELL",
      price: sig.triggerPrice,
      triggerPrice: sig.triggerPrice,
      pivotPrice: sig.pivotPrice ?? sig.triggerPrice,
      time: sig.signalTime,
      triggerTime: sig.triggerTime || sig.signalTime,
      pivotTime: sig.pivotTime || sig.signalTime,
      badgeText: sig.badgeText,
      signalTag: sig.badgeText,
    },
    ruleSnapshot: {
      rule: sig.badgeText,
    },
    createdAt: sig.signalTime,
  };
}

/**
 * 将回测历史信号数组转换为图表 Marker 视觉指令（用于全景回测模式）
 */
export function convertBacktestSignalsToCommands(
  symbolSignals: StrategyBacktestSignalResult[],
  safeK: IFetchK[],
  layerName = "tactical_events"
): VisualCommandVo[] {
  const minTimeMs = safeK[0] ? new Date(safeK[0].time).getTime() : 0;
  const maxTimeMs = safeK[safeK.length - 1]
    ? new Date(safeK[safeK.length - 1].time).getTime()
    : Infinity;

  return symbolSignals.map((sig) => {
    const ctx = (sig.contextSnapshot || {}) as Record<string, unknown>;
    const chanBsp = (ctx.chanBsp || {}) as Record<string, unknown>;
    const trace = (sig.decisionTrace || {}) as Record<string, unknown>;

    const rawType = String(
      sig.signalType ||
      chanBsp.type ||
      ctx.type ||
      "signal"
    );
    const isSell =
      rawType.includes("sell") ||
      rawType === "exit" ||
      ctx.action === "SELL" ||
      trace.action === "SELL";
    const isBuy = !isSell;

    const label =
      sig.badgeText ||
      (typeof ctx.badgeText === "string" ? ctx.badgeText : undefined) ||
      (typeof ctx.signalTag === "string" ? ctx.signalTag : undefined) ||
      (typeof trace.signalTag === "string" ? trace.signalTag : undefined) ||
      (isBuy ? "买点" : "卖点");

    const rawPrice = ctx.pivotPrice ?? ctx.triggerPrice ?? trace.price ?? ctx.price;
    const price =
      typeof rawPrice === "number" && Number.isFinite(rawPrice)
        ? rawPrice
        : undefined;

    const pivotMs = ctx.pivotTime ? new Date(ctx.pivotTime as string).getTime() : 0;
    const targetTime =
      pivotMs >= minTimeMs && pivotMs <= maxTimeMs && ctx.pivotTime
        ? (ctx.pivotTime as string)
        : sig.signalTime;

    return {
      id: `backtest_sig_${sig.id}`,
      type: "text",
      layer: layerName,
      time: targetTime,
      price,
      text: label,
      position: isSell ? "above" : "below",
      color: isSell ? "#22C55E" : "#EF4444",
    };
  });
}

/**
 * 将仿真推流实时信号数组转换为图表 Marker 视觉指令（用于单步推演复盘模式）
 */
export function convertReplaySignalsToCommands(
  replaySignals: SimulationSignalVo[],
  minTimeMs: number
): VisualCommandVo[] {
  const list: VisualCommandVo[] = [];
  for (let idx = 0; idx < replaySignals.length; idx++) {
    const sig = replaySignals[idx];
    const pivotMs = sig.pivotTime ? new Date(sig.pivotTime).getTime() : 0;
    const targetTime =
      pivotMs >= minTimeMs && sig.pivotTime ? sig.pivotTime : sig.signalTime;
    const targetMs = new Date(targetTime).getTime();
    if (minTimeMs > 0 && targetMs < minTimeMs) continue;

    list.push({
      id: `replay_sig_${idx}_${sig.signalType}`,
      type: "text",
      layer: "backtest_signals",
      time: targetTime,
      price: sig.pivotPrice ?? sig.triggerPrice,
      text: sig.badgeText || (sig.isBuy ? "买点" : "卖点"),
      position: sig.isBuy ? "below" : "above",
      color: sig.isBuy ? "#EF4444" : "#22C55E",
    });
  }
  return list;
}
