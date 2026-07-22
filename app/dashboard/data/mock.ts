/**
 * Dashboard mock 数据。
 *
 * 用确定性伪随机生成时间序列，保证 SSR/CSR 一致（无 Math.random 在渲染期）。
 * 数据按 RangeKey 切片，模拟"实盘监控"所需的 KPI/权益/回撤/持仓/连接。
 */
import type {
  KpiMetric,
  EquityPoint,
  DrawdownPoint,
  PositionRow,
  ConnectionStatus,
  RangeKey,
} from "../lib/types";

/** 确定性伪随机（mulberry32），给定 seed 可复现。 */
function seeded(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 各 RangeKey 对应的交易日天数。 */
const RANGE_DAYS: Record<RangeKey, number> = {
  "1D": 1,
  "1W": 5,
  "1M": 22,
  "3M": 66,
  "1Y": 252,
  MAX: 756,
};

/** 生成权益曲线 + 回撤序列（策略/基准/超额）。 */
function generateSeries(days: number, seed: number): {
  equity: EquityPoint[];
  drawdown: DrawdownPoint[];
} {
  const rand = seeded(seed);
  const equity: EquityPoint[] = [];
  // 策略年化 ~18%，基准年化 ~8%，略带波动与轻微超额
  const stratDailyRet = 1 + 0.18 / 252;
  const benchDailyRet = 1 + 0.08 / 252;
  let strat = 0;
  let bench = 0;
  let peak = 0;

  const today = new Date("2026-07-22T00:00:00");
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    // 噪声 ±1.2%
    const noise = (rand() - 0.5) * 0.024;
    const benchNoise = (rand() - 0.5) * 0.016;
    strat = strat * stratDailyRet + noise + 0.0001;
    bench = bench * benchDailyRet + benchNoise;
    peak = Math.max(peak, strat);
    equity.push({
      date: d.toISOString().slice(0, 10),
      strategy: strat,
      benchmark: bench,
      excess: strat - bench,
    });
  }

  // 回撤序列
  const drawdown: DrawdownPoint[] = equity.map((p) => {
    const dd = p.strategy - peak;
    return { date: p.date, drawdown: dd < 0 ? dd : 0 };
  });

  return { equity, drawdown };
}

const FULL = generateSeries(RANGE_DAYS.MAX, 42);

export function getEquitySeries(range: RangeKey): EquityPoint[] {
  const days = RANGE_DAYS[range];
  return FULL.equity.slice(-days);
}

export function getDrawdownSeries(range: RangeKey): DrawdownPoint[] {
  const days = RANGE_DAYS[range];
  return FULL.drawdown.slice(-days);
}

/** 顶部 KPI（基于 MAX 区间统计）。 */
export function getKpiMetrics(range: RangeKey): KpiMetric[] {
  const eq = getEquitySeries(range);
  const last = eq[eq.length - 1];
  const prev = eq[eq.length - 2] ?? eq[0];
  const dailyReturn = last ? prev ? last.strategy - prev.strategy : 0 : 0;
  const cumReturn = last?.strategy ?? 0;
  const dd = FULL.drawdown.reduce(
    (m, p) => Math.min(m, p.drawdown),
    0
  );
  // 年化夏普（mock：用累计收益/波动 近似）
  const sharpe = 1.34 + (range === "1D" ? 0 : 0.05 * (eq.length / 100));

  return [
    {
      key: "nav",
      label: "账户净值",
      value: 1 + cumReturn,
      format: "number",
      decimals: 4,
    },
    {
      key: "daily",
      label: "日收益",
      value: dailyReturn,
      format: "percent",
      isPnl: true,
      sublabel: "今日",
    },
    {
      key: "cum",
      label: "累计收益",
      value: cumReturn,
      format: "percent",
      isPnl: true,
      sublabel: range,
    },
    {
      key: "dd",
      label: "最大回撤",
      value: dd,
      format: "percent",
      decimals: 2,
      // 回撤是负值，用风险色
    },
    {
      key: "sharpe",
      label: "夏普比率",
      value: sharpe,
      format: "ratio",
      decimals: 2,
    },
  ];
}

export function getPositions(): PositionRow[] {
  return [
    {
      key: "1",
      symbol: "600519",
      name: "贵州茅台",
      quantity: 200,
      costPrice: 1680.5,
      lastPrice: 1742.3,
      marketValue: 348460,
      pnl: 12360,
      pnlRatio: 0.0368,
      weight: 0.348,
    },
    {
      key: "2",
      symbol: "000858",
      name: "五粮液",
      quantity: 500,
      costPrice: 142.8,
      lastPrice: 138.6,
      marketValue: 69300,
      pnl: -2100,
      pnlRatio: -0.0294,
      weight: 0.069,
    },
    {
      key: "3",
      symbol: "300750",
      name: "宁德时代",
      quantity: 300,
      costPrice: 185.2,
      lastPrice: 198.4,
      marketValue: 59520,
      pnl: 3960,
      pnlRatio: 0.0713,
      weight: 0.06,
    },
    {
      key: "4",
      symbol: "601318",
      name: "中国平安",
      quantity: 1000,
      costPrice: 48.6,
      lastPrice: 46.9,
      marketValue: 46900,
      pnl: -1700,
      pnlRatio: -0.035,
      weight: 0.047,
    },
    {
      key: "5",
      symbol: "000333",
      name: "美的集团",
      quantity: 800,
      costPrice: 62.3,
      lastPrice: 65.1,
      marketValue: 52080,
      pnl: 2240,
      pnlRatio: 0.0449,
      weight: 0.052,
    },
  ];
}

export function getConnectionStatus(): ConnectionStatus {
  return {
    state: "online",
    latencyMs: 128,
    lastUpdated: "2026-07-22T15:30:00+08:00",
    timezone: "Asia/Shanghai",
  };
}
