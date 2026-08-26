"use client";

import type { StrategyBacktestSignalResult } from "@/app/api/client";

interface BacktestSignalTableProps {
  signals: StrategyBacktestSignalResult[];
  selectedSignalId: number | null;
  onSelectSignal: (signal: StrategyBacktestSignalResult) => void;
}

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  return value.replace("T", " ").replace(/\.\d+Z$/, "");
};

const BSP_LABEL_MAP: Record<string, { label: string; isBuy: boolean }> = {
  first_buy: { label: "1买", isBuy: true },
  first_sell: { label: "1卖", isBuy: false },
  second_buy: { label: "2买", isBuy: true },
  second_sell: { label: "2卖", isBuy: false },
  third_buy: { label: "3买", isBuy: true },
  third_sell: { label: "3卖", isBuy: false },
  entry: { label: "买入", isBuy: true },
  exit: { label: "卖出", isBuy: false },
};

function parseSignalInfo(sig: StrategyBacktestSignalResult) {
  const ctx = (sig.contextSnapshot || {}) as Record<string, unknown>;
  const rawType = String(ctx.type || ctx.signalKind || "signal");
  const parsed = BSP_LABEL_MAP[rawType] || {
    label: rawType.includes("buy") ? "买点" : rawType.includes("sell") ? "卖点" : rawType,
    isBuy: rawType.includes("buy") || rawType === "entry",
  };

  const price = typeof ctx.price === "number" ? ctx.price : Number(ctx.price ?? 0);

  return {
    label: parsed.label,
    isBuy: parsed.isBuy,
    price: price > 0 ? price.toFixed(2) : "-",
  };
}

export function BacktestSignalTable({
  signals,
  selectedSignalId,
  onSelectSignal,
}: BacktestSignalTableProps) {
  if (signals.length === 0) {
    return (
      <div className="backtest-signal-empty">
        <p className="strategy-muted">当前回测任务未触发任何买卖点信号。</p>
      </div>
    );
  }

  return (
    <div className="backtest-signal-table-wrap">
      <div className="strategy-section-title">
        <h2>命中信号列表</h2>
        <span>共 {signals.length} 条信号（点击某行可在图表中居中聚焦并查看中枢诊断）</span>
      </div>

      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>标的代码</th>
            <th>信号类型</th>
            <th>触发价格</th>
            <th>信号时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {signals.map((sig, idx) => {
            const isSelected = sig.id === selectedSignalId;
            const { label, isBuy, price } = parseSignalInfo(sig);

            return (
              <tr
                key={sig.id}
                className={isSelected ? "selected-row" : ""}
                onClick={() => onSelectSignal(sig)}
                style={{ cursor: "pointer" }}
              >
                <td className="tnum">{idx + 1}</td>
                <td>
                  <strong>{sig.securityCode}</strong>
                </td>
                <td>
                  <span
                    className={`bsp-tag ${isBuy ? "bsp-buy" : "bsp-sell"}`}
                  >
                    {label}
                  </span>
                </td>
                <td className="tnum">{price}</td>
                <td className="tnum">{formatDateTime(sig.signalTime)}</td>
                <td>
                  <button
                    type="button"
                    className="action-link-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectSignal(sig);
                    }}
                  >
                    诊断 & 定位
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
