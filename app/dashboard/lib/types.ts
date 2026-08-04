/**
 * Dashboard 概览页数据模型。
 *
 * 这些类型定义了"实盘监控"所需的最小数据契约：
 *  KPI 指标、权益曲线（含基准/超额）、回撤序列、持仓快照、连接状态。
 * 后端就绪前用 mock 数据驱动渲染（data/mock.ts）。
 */

/** 单个 KPI 指标卡片数据。 */
export interface KpiMetric {
  key: string;
  label: string;
  /** 主数值（已格式化的字符串，由组件保证 tabular 对齐）。 */
  value: number;
  /** 数值格式：百分比/货币/数值/比率。 */
  format: "percent" | "currency" | "number" | "ratio";
  /** 数值小数位。 */
  decimals?: number;
  /** 是否为盈亏类（用盈/亏语义色着色，正红负绿 A 股惯例）。 */
  isPnl?: boolean;
  /** 副标签（如"日"/"累计"）。 */
  sublabel?: string;
}

/** 权益曲线单点：策略净值、基准净值、超额收益。 */
export interface EquityPoint {
  /** ISO 日期字符串。 */
  date: string;
  /** 策略累计收益率（小数，0.12 = 12%）。 */
  strategy: number;
  /** 基准累计收益率。 */
  benchmark: number;
  /** 超额 = strategy - benchmark。 */
  excess: number;
}

/** 回撤序列单点。 */
export interface DrawdownPoint {
  date: string;
  /** 回撤值（负数，0 表示无回撤）。 */
  drawdown: number;
}

/** 持仓快照单行。 */
export interface PositionRow {
  key: string;
  /** 证券代码。 */
  symbol: string;
  /** 证券名称。 */
  name: string;
  /** 持仓数量。 */
  quantity: number;
  /** 持仓成本。 */
  costPrice: number;
  /** 最新价。 */
  lastPrice: number;
  /** 市值。 */
  marketValue: number;
  /** 浮动盈亏金额。 */
  pnl: number;
  /** 浮动盈亏比例（小数）。 */
  pnlRatio: number;
  /** 仓位权重（小数，0-1）。 */
  weight: number;
}

/** 连接/数据新鲜度状态。 */
export interface ConnectionStatus {
  /** 在线/重连中/断连。 */
  state: "online" | "reconnecting" | "disconnected";
  /** 最近一次请求延迟（ms）。 */
  latencyMs: number;
  /** 数据最近更新时间（ISO）。 */
  lastUpdated: string;
  /** 展示用时区，如 "Asia/Shanghai"。 */
  timezone: string;
}

/** 时间范围档位。 */
export type RangeKey = "1D" | "1W" | "1M" | "3M" | "1Y" | "MAX";
