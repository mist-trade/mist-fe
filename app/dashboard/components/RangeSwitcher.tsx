"use client";

import type { RangeKey } from "../lib/types";

export interface RangeSwitcherProps {
  value: RangeKey;
  onChange: (range: RangeKey) => void;
  /** 可选档位，默认全档。 */
  options?: RangeKey[];
}

const DEFAULT_OPTIONS: RangeKey[] = ["1D", "1W", "1M", "3M", "1Y", "MAX"];

/**
 * 时间范围切换器：1D/1W/1M/3M/1Y/MAX。
 * 紧凑分段控件，选中态用品牌色。
 */
export function RangeSwitcher({
  value,
  onChange,
  options = DEFAULT_OPTIONS,
}: RangeSwitcherProps) {
  return (
    <div
      role="tablist"
      aria-label="时间范围"
      style={{
        display: "inline-flex",
        gap: 2,
        padding: 2,
        borderRadius: 6,
        background: "var(--surface-base)",
        border: "1px solid var(--border-subtle)",
      }}
    >
      {options.map((opt) => {
        const active = opt === value;
        return (
          <button
            key={opt}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt)}
            className="tnum"
            style={{
              border: "none",
              borderRadius: 4,
              padding: "4px 10px",
              fontSize: 13,
              cursor: "pointer",
              background: active ? "var(--brand)" : "transparent",
              color: active ? "var(--brand-fg)" : "var(--text-secondary)",
              fontWeight: active ? 600 : 400,
              transition: "background 0.15s, color 0.15s",
            }}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}
