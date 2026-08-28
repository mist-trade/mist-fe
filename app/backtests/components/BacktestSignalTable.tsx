"use client";

import { useMemo, useState } from "react";
import type { StrategyBacktestSignalResult } from "@/app/api/client";
import { formatShanghaiDateTime } from "@/app/lib/time";

interface BacktestSignalTableProps {
  signals: StrategyBacktestSignalResult[];
  selectedSignalId: number | null;
  onSelectSignal: (signal: StrategyBacktestSignalResult) => void;
}

const formatDateTime = (value?: string | null) => {
  return formatShanghaiDateTime(value);
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
  const chanBsp = (ctx.chanBsp || {}) as Record<string, unknown>;
  const rawType = String(chanBsp.type || ctx.type || ctx.signalKind || "signal");
  const parsed = BSP_LABEL_MAP[rawType] || {
    label: rawType.includes("buy") ? "买点" : rawType.includes("sell") ? "卖点" : rawType,
    isBuy: rawType.includes("buy") || rawType === "entry",
  };

  const rawPrice = ctx.triggerPrice ?? ctx.price;
  const price = typeof rawPrice === "number" ? rawPrice : Number(rawPrice ?? 0);

  return {
    rawType,
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
  const [filterType, setFilterType] = useState<"all" | "buy" | "sell" | "1bsp" | "2bsp" | "3bsp">("all");
  const [keyword, setKeyword] = useState("");

  const parsedSignals = useMemo(() => {
    return signals.map((rawSignal) => ({
      rawSignal,
      parsed: parseSignalInfo(rawSignal),
    }));
  }, [signals]);

  const filteredSignals = useMemo(() => {
    return parsedSignals.filter(({ rawSignal, parsed }) => {
      if (keyword.trim() && !rawSignal.securityCode.includes(keyword.trim())) {
        return false;
      }
      if (filterType === "buy" && !parsed.isBuy) return false;
      if (filterType === "sell" && parsed.isBuy) return false;
      if (filterType === "1bsp" && !parsed.label.includes("1")) return false;
      if (filterType === "2bsp" && !parsed.label.includes("2")) return false;
      if (filterType === "3bsp" && !parsed.label.includes("3")) return false;
      return true;
    });
  }, [parsedSignals, filterType, keyword]);

  const buyCount = useMemo(() => parsedSignals.filter((s) => s.parsed.isBuy).length, [parsedSignals]);
  const sellCount = parsedSignals.length - buyCount;

  if (signals.length === 0) {
    return (
      <div className="backtest-signal-empty">
        <p className="strategy-muted">当前回测任务未触发任何买卖点信号。</p>
      </div>
    );
  }

  return (
    <div className="backtest-signal-table-wrap">
      <div className="strategy-section-title" style={{ flexWrap: "wrap", gap: "8px" }}>
        <div>
          <h2>命中信号列表</h2>
          <span className="strategy-muted">
            共 {signals.length} 条信号（买点 {buyCount} / 卖点 {sellCount}）· 点击信号可在图表自动定位并查看缠论中枢几何
          </span>
        </div>

        {/* 筛选过滤工具条 */}
        <div className="signal-filter-bar">
          <input
            className="signal-search-input"
            placeholder="筛选标的…"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
          <div className="filter-pill-group">
            <button
              type="button"
              className={`filter-pill ${filterType === "all" ? "active" : ""}`}
              onClick={() => setFilterType("all")}
            >
              全部 ({signals.length})
            </button>
            <button
              type="button"
              className={`filter-pill ${filterType === "buy" ? "active" : ""}`}
              onClick={() => setFilterType("buy")}
            >
              🟢 买点 ({buyCount})
            </button>
            <button
              type="button"
              className={`filter-pill ${filterType === "sell" ? "active" : ""}`}
              onClick={() => setFilterType("sell")}
            >
              🔴 卖点 ({sellCount})
            </button>
            <button
              type="button"
              className={`filter-pill ${filterType === "1bsp" ? "active" : ""}`}
              onClick={() => setFilterType("1bsp")}
            >
              1买/1卖
            </button>
            <button
              type="button"
              className={`filter-pill ${filterType === "2bsp" ? "active" : ""}`}
              onClick={() => setFilterType("2bsp")}
            >
              2买/2卖
            </button>
            <button
              type="button"
              className={`filter-pill ${filterType === "3bsp" ? "active" : ""}`}
              onClick={() => setFilterType("3bsp")}
            >
              3买/3卖
            </button>
          </div>
        </div>
      </div>

      <div className="table-responsive-container">
        <table>
          <thead>
            <tr>
              <th style={{ width: "45px" }}>#</th>
              <th>标的代码</th>
              <th>信号类型</th>
              <th>触发价格</th>
              <th>信号时间</th>
              <th style={{ width: "100px" }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredSignals.map(({ rawSignal, parsed }, idx) => {
              const isSelected = rawSignal.id === selectedSignalId;
              const { label, isBuy, price } = parsed;

              return (
                <tr
                  key={rawSignal.id}
                  className={isSelected ? "selected-row" : ""}
                  onClick={() => onSelectSignal(rawSignal)}
                  style={{ cursor: "pointer" }}
                >
                  <td className="tnum">{idx + 1}</td>
                  <td>
                    <strong>{rawSignal.securityCode}</strong>
                  </td>
                  <td>
                    <span
                      className={`bsp-tag ${isBuy ? "bsp-buy" : "bsp-sell"}`}
                    >
                      <span className="bsp-arrow">{isBuy ? "▲" : "▼"}</span>
                      {label}
                    </span>
                  </td>
                  <td className="tnum">{price}</td>
                  <td className="tnum">{formatDateTime(rawSignal.signalTime)}</td>
                  <td>
                    <button
                      type="button"
                      className="action-link-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectSignal(rawSignal);
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
    </div>
  );
}

export default BacktestSignalTable;
