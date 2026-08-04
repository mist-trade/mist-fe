"use client";

import { Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { PositionRow } from "../lib/types";
import { formatNumber, formatPercent, formatCurrency } from "../lib/format";

export interface PositionsTableProps {
  data: PositionRow[];
  loading?: boolean;
}

/**
 * 持仓快照表（antd Table）。
 *
 * 设计契约：
 *  - 盈亏列：正数红（盈）、负数绿（亏），A 股惯例
 *  - 数字列 tabular-nums，右对齐
 *  - 可按盈亏/仓位排序（演示 antd Table 排序能力）
 *  - 紧凑行高（ConfigProvider token 已设 cellPaddingBlock:8）
 */
export function PositionsTable({ data, loading }: PositionsTableProps) {
  const columns: ColumnsType<PositionRow> = [
    {
      title: "证券",
      key: "symbol",
      render: (_, r) => (
        <span>
          <span className="tnum" style={{ fontWeight: 500 }}>
            {r.symbol}
          </span>
          <span style={{ color: "var(--text-muted)", marginLeft: 8 }}>
            {r.name}
          </span>
        </span>
      ),
    },
    {
      title: "持仓",
      dataIndex: "quantity",
      key: "quantity",
      align: "right",
      width: 90,
      render: (v: number) => (
        <span className="tnum">{formatNumber(v, 0)}</span>
      ),
    },
    {
      title: "成本价",
      dataIndex: "costPrice",
      key: "costPrice",
      align: "right",
      width: 100,
      render: (v: number) => <span className="tnum">{formatNumber(v, 2)}</span>,
    },
    {
      title: "最新价",
      dataIndex: "lastPrice",
      key: "lastPrice",
      align: "right",
      width: 100,
      render: (v: number) => <span className="tnum">{formatNumber(v, 2)}</span>,
    },
    {
      title: "市值",
      dataIndex: "marketValue",
      key: "marketValue",
      align: "right",
      width: 110,
      sorter: (a, b) => a.marketValue - b.marketValue,
      render: (v: number) => <span className="tnum">{formatCurrency(v)}</span>,
    },
    {
      title: "浮动盈亏",
      key: "pnl",
      align: "right",
      width: 120,
      sorter: (a, b) => a.pnl - b.pnl,
      render: (_, r) => (
        <span className="tnum" style={{ color: pnlColor(r.pnl) }}>
          {r.pnl >= 0 ? "+" : ""}
          {formatNumber(r.pnl, 0)}
        </span>
      ),
    },
    {
      title: "盈亏%",
      dataIndex: "pnlRatio",
      key: "pnlRatio",
      align: "right",
      width: 90,
      sorter: (a, b) => a.pnlRatio - b.pnlRatio,
      defaultSortOrder: "descend",
      render: (v: number) => (
        <span className="tnum" style={{ color: pnlColor(v) }}>
          {formatPercent(v)}
        </span>
      ),
    },
    {
      title: "仓位",
      dataIndex: "weight",
      key: "weight",
      align: "right",
      width: 80,
      sorter: (a, b) => a.weight - b.weight,
      render: (v: number) => (
        <span className="tnum">{formatPercent(v, 1)}</span>
      ),
    },
  ];

  return (
    <Table<PositionRow>
      columns={columns}
      dataSource={data}
      loading={loading}
      rowKey="key"
      size="small"
      pagination={false}
      scroll={{ x: "max-content" }}
      locale={{ emptyText: "暂无持仓" }}
    />
  );
}

/** 盈亏色：正红负绿（A 股），0 不着色。 */
function pnlColor(value: number): string {
  if (value > 0) return "var(--sem-profit)";
  if (value < 0) return "var(--sem-loss)";
  return "var(--text-primary)";
}
