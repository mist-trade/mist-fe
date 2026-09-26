"use client";

import { useMemo, useState } from "react";
import type { StrategyBacktestSignalResult } from "@/app/api/client";
import { formatShanghaiDateTime } from "@/app/lib/time";

interface BacktestSignalTableProps {
  signals: StrategyBacktestSignalResult[];
  selectedSignalId: number | null;
  onSelectSignal: (signal: StrategyBacktestSignalResult) => void;
  onOpenLiveKLine?: (securityCode: string, timestamp: string) => void;
}

const formatDateTime = (value?: string | null) => {
  return formatShanghaiDateTime(value);
};

const CHAN_LABEL_MAP: Record<string, string> = {
  first_buy: "1买",
  first_sell: "1卖",
  second_buy: "2买",
  second_sell: "2卖",
  third_buy: "3买",
  third_sell: "3卖",
};

function parseSignalInfo(sig: StrategyBacktestSignalResult) {
  const ctx = (sig.contextSnapshot || {}) as Record<string, unknown>;
  const chanBsp = (ctx.chanBsp || {}) as Record<string, unknown>;
  const rawType = String(sig.signalType || chanBsp.type || ctx.type || "signal");

  const isBuy = rawType.includes("buy") || rawType === "entry";
  let label = CHAN_LABEL_MAP[rawType];
  if (!label && ctx.badgeText && typeof ctx.badgeText === "string") {
    label = ctx.badgeText;
  }
  if (!label) {
    label = (ctx.signalTag as string) || (isBuy ? "买入" : "卖出");
  }

  const rawPrice = ctx.triggerPrice ?? ctx.price;
  const price = typeof rawPrice === "number" ? rawPrice : Number(rawPrice ?? 0);

  const confidence = sig.confidence ?? 85.0;
  const confidenceLevel = sig.confidenceLevel ?? (confidence >= 80 ? "HIGH" : confidence >= 65 ? "MEDIUM" : "LOW");

  return {
    rawType,
    label,
    isBuy,
    price: price > 0 ? price.toFixed(2) : "-",
    confidence: Number(confidence).toFixed(1),
    confidenceLevel,
  };
}

export function BacktestSignalTable({
  signals,
  selectedSignalId,
  onSelectSignal,
  onOpenLiveKLine,
}: BacktestSignalTableProps) {
  const [filterType, setFilterType] = useState<"all" | "buy" | "sell" | "high_conf">("all");
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
      if (filterType === "high_conf" && parsed.confidenceLevel !== "HIGH") return false;
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
            共 {signals.length} 条信号（买点 {buyCount} / 卖点 {sellCount}）· 点击信号查看白盒归因与图表定位
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
              买点 ({buyCount})
            </button>
            <button
              type="button"
              className={`filter-pill ${filterType === "sell" ? "active" : ""}`}
              onClick={() => setFilterType("sell")}
            >
              卖点 ({sellCount})
            </button>
            <button
              type="button"
              className={`filter-pill ${filterType === "high_conf" ? "active" : ""}`}
              onClick={() => setFilterType("high_conf")}
            >
              高置信度 (HIGH)
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
              <th>置信度</th>
              <th>触发价格</th>
              <th>信号时间</th>
              <th style={{ width: "160px" }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredSignals.map(({ rawSignal, parsed }, idx) => {
              const isSelected = rawSignal.id === selectedSignalId;
              const { label, isBuy, price, confidence, confidenceLevel } = parsed;

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
                  <td>
                    <span
                      className="tnum"
                      style={{
                        padding: "2px 6px",
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 600,
                        background:
                          confidenceLevel === "HIGH"
                            ? "rgba(74, 222, 128, 0.12)"
                            : confidenceLevel === "MEDIUM"
                              ? "rgba(251, 191, 36, 0.12)"
                              : "rgba(248, 113, 113, 0.12)",
                        color:
                          confidenceLevel === "HIGH"
                            ? "var(--sem-success)"
                            : confidenceLevel === "MEDIUM"
                              ? "var(--sem-warn)"
                              : "var(--sem-danger)",
                      }}
                    >
                      {confidenceLevel} {confidence}%
                    </span>
                  </td>
                  <td className="tnum">{price}</td>
                  <td className="tnum">{formatDateTime(rawSignal.signalTime)}</td>
                  <td>
                    <div style={{ display: "flex", gap: 8 }}>
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
                      {onOpenLiveKLine ? (
                        <button
                          type="button"
                          className="action-link-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenLiveKLine(rawSignal.securityCode, rawSignal.signalTime);
                          }}
                          style={{ color: "var(--brand)" }}
                        >
                          看盘 ↗
                        </button>
                      ) : null}
                    </div>
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
