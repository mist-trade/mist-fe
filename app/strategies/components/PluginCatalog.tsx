"use client";

import { useState } from "react";
import type { FactorPluginVo } from "@/app/api/client";

const CATEGORY_NAMES: Record<string, { label: string; desc: string }> = {
  ALL: { label: "全部流派", desc: "查看平台内所有已装配的因子插件" },
  REGIME: { label: "宏观大盘", desc: "大盘环境、多空状态与系统性风险过滤" },
  FUNDAMENTAL: { label: "基本面", desc: "财务质量、ROE、偿债能力与估值安全垫" },
  CAPITAL: { label: "资金面", desc: "北向外资、主力资金流向与微观流动性" },
  EVENT: { label: "事件驱动", desc: "财报预告、重大公告与行业催化事件" },
  TECHNICAL: { label: "经典量价", desc: "均线突破、放量异动与经典动量指标" },
  CHAN: { label: "缠论形态", desc: "基于几何学与背驰动力学的一/二/三类买卖点" },
  AI_SENTIMENT: { label: "AI与舆情", desc: "研报一致预期、大模型NLP情绪与另类特征" },
};

export interface PluginCatalogProps {
  plugins: FactorPluginVo[];
  onSelectPlugin?: (plugin: FactorPluginVo) => void;
}

export function PluginCatalog({ plugins, onSelectPlugin }: PluginCatalogProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [searchKeyword, setSearchKeyword] = useState<string>("");

  const filteredPlugins = plugins.filter((p) => {
    const matchCat = selectedCategory === "ALL" || p.category === selectedCategory;
    const matchKw =
      !searchKeyword ||
      p.name.toLowerCase().includes(searchKeyword.toLowerCase()) ||
      p.id.toLowerCase().includes(searchKeyword.toLowerCase()) ||
      p.description.toLowerCase().includes(searchKeyword.toLowerCase());
    return matchCat && matchKw;
  });

  return (
    <div className="plugin-catalog" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
          {Object.entries(CATEGORY_NAMES).map(([catKey, info]) => {
            const isSelected = selectedCategory === catKey;
            return (
              <button
                key={catKey}
                type="button"
                onClick={() => setSelectedCategory(catKey)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 6,
                  fontSize: 13,
                  cursor: "pointer",
                  border: isSelected ? "1px solid var(--brand)" : "1px solid var(--border-subtle)",
                  background: isSelected ? "rgba(43, 169, 192, 0.15)" : "var(--surface-raised)",
                  color: isSelected ? "var(--brand)" : "var(--text-secondary)",
                  fontWeight: isSelected ? 600 : 400,
                  transition: "all 0.15s ease",
                }}
              >
                {info.label}
              </button>
            );
          })}
        </div>

        <input
          type="text"
          placeholder="搜索因子名称/ID/描述..."
          value={searchKeyword}
          onChange={(e) => setSearchKeyword(e.target.value)}
          style={{
            padding: "6px 12px",
            borderRadius: 6,
            border: "1px solid var(--border-subtle)",
            background: "var(--surface-raised)",
            color: "var(--text-primary)",
            fontSize: 13,
            minWidth: 220,
          }}
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: 16,
        }}
      >
        {filteredPlugins.length === 0 ? (
          <div
            style={{
              gridColumn: "1 / -1",
              padding: 32,
              textAlign: "center",
              color: "var(--text-muted)",
              background: "var(--surface-raised)",
              borderRadius: 8,
              border: "1px solid var(--border-subtle)",
            }}
          >
            暂无匹配的因子插件
          </div>
        ) : (
          filteredPlugins.map((plugin) => {
            const catInfo = CATEGORY_NAMES[plugin.category] ?? { label: plugin.category };
            return (
              <div
                key={plugin.id}
                style={{
                  padding: 16,
                  borderRadius: 8,
                  border: "1px solid var(--border-subtle)",
                  background: "var(--surface-raised)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: 12,
                  boxShadow: "var(--shadow-card)",
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: 4,
                        fontSize: 11,
                        background: "rgba(43, 169, 192, 0.12)",
                        color: "var(--brand)",
                        border: "1px solid rgba(43, 169, 192, 0.3)",
                      }}
                    >
                      {catInfo.label}
                    </span>
                    <span className="tnum" style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      v{plugin.version}
                    </span>
                  </div>

                  <h3 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 4px 0", color: "var(--text-primary)" }}>
                    {plugin.name}
                  </h3>
                  <code style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 8 }}>
                    {plugin.id}
                  </code>

                  <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5, margin: 0 }}>
                    {plugin.description}
                  </p>
                </div>

                {onSelectPlugin ? (
                  <button
                    type="button"
                    onClick={() => onSelectPlugin(plugin)}
                    style={{
                      marginTop: 8,
                      padding: "6px 12px",
                      borderRadius: 6,
                      border: "1px solid var(--border-subtle)",
                      background: "var(--surface-base)",
                      color: "var(--brand)",
                      fontSize: 12,
                      cursor: "pointer",
                      textAlign: "center",
                      fontWeight: 500,
                    }}
                  >
                    + 装配到决策流
                  </button>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
