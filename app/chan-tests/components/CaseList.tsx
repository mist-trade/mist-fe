"use client";

import type { CaseWithMeta } from "../lib/load-snapshot";

interface CaseListProps {
  cases: CaseWithMeta[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
}

export function CaseList({ cases, selectedKey, onSelect }: CaseListProps) {
  return (
    <aside
      style={{
        width: 240,
        borderRight: "1px solid #e5e7eb",
        padding: 16,
        overflowY: "auto",
      }}
    >
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
        测试用例
      </h2>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, gap: 4 }}>
        {cases.map(({ testCase, meta }) => {
          const selected = testCase.key === selectedKey;
          return (
            <li key={testCase.key}>
              <button
                type="button"
                onClick={() => onSelect(testCase.key)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "8px 10px",
                  borderRadius: 6,
                  border: "none",
                  background: selected ? "#eff6ff" : "transparent",
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span>{testCase.name}</span>
                {meta ? (
                  <span style={{ fontSize: 11, color: "#10b981" }}>●</span>
                ) : (
                  <span style={{ fontSize: 11, color: "#9ca3af" }}>○</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
