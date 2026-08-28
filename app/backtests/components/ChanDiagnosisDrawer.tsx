"use client";

import type { StrategyBacktestSignalResult } from "@/app/api/client";
import { formatShanghaiDateTime } from "@/app/lib/time";

interface ChanDiagnosisDrawerProps {
  signal: StrategyBacktestSignalResult | null;
  onClose: () => void;
}

const formatDateTime = (value?: string | null) => {
  return formatShanghaiDateTime(value);
};

const BSP_TITLES: Record<string, { title: string; desc: string }> = {
  first_buy: {
    title: "第一类买点 (1买)",
    desc: "趋势背驰引发的转折点，中枢下方离开段 c 相对进段 a 的 MACD 动量力度衰竭。",
  },
  first_sell: {
    title: "第一类卖点 (1卖)",
    desc: "趋势背驰引发的转折点，中枢上方离开段 c 相对进段 a 的 MACD 动量力度衰竭。",
  },
  second_buy: {
    title: "第二类买点 (2买)",
    desc: "第一类买点后的次级别回抽确认低点，且不破第一类买点前低点（纯几何结构确认）。",
  },
  second_sell: {
    title: "第二类卖点 (2卖)",
    desc: "第一类卖点后的次级别回抽确认高点，且不破第一类卖点前高点（纯几何结构确认）。",
  },
  third_buy: {
    title: "第三类买点 (3买)",
    desc: "次级别离开中枢后，相邻次级别回抽低点不回原中枢区间（严格口径：低点 > ZG）。",
  },
  third_sell: {
    title: "第三类卖点 (3卖)",
    desc: "次级别离开中枢后，相邻次级别回抽高点不回原中枢区间（严格口径：高点 < ZD）。",
  },
};

export function ChanDiagnosisDrawer({ signal, onClose }: ChanDiagnosisDrawerProps) {
  if (!signal) return null;

  const ctx = (signal.contextSnapshot || {}) as Record<string, unknown>;
  const chanBsp = (ctx.chanBsp || {}) as Record<string, unknown>;
  const rawType = String(chanBsp.type || ctx.type || ctx.signalKind || "signal");
  const bspMeta = BSP_TITLES[rawType] || {
    title: `策略信号 (${rawType})`,
    desc: "自定义规则或策略匹配触发的信号快照。",
  };

  const rawZg = chanBsp.zg ?? ctx.zg;
  const rawZd = chanBsp.zd ?? ctx.zd;
  const rawGg = chanBsp.gg ?? ctx.gg;
  const rawDd = chanBsp.dd ?? ctx.dd;
  const rawPrice = ctx.triggerPrice ?? ctx.price;

  const zg = rawZg !== undefined && rawZg !== null ? Number(rawZg) : null;
  const zd = rawZd !== undefined && rawZd !== null ? Number(rawZd) : null;
  const gg = rawGg !== undefined && rawGg !== null ? Number(rawGg) : null;
  const dd = rawDd !== undefined && rawDd !== null ? Number(rawDd) : null;
  const price = rawPrice !== undefined && rawPrice !== null ? Number(rawPrice) : null;

  return (
    <div className="chan-diagnosis-drawer-backdrop" onClick={onClose}>
      <div
        className="chan-diagnosis-drawer"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="缠论中枢与背驰诊断"
      >
        <header className="drawer-header">
          <div>
            <h2>{bspMeta.title}</h2>
            <p className="strategy-muted">标的代码：{signal.securityCode}</p>
          </div>
          <button type="button" className="drawer-close-btn" onClick={onClose}>
            ✕
          </button>
        </header>

        <div className="drawer-content">
          {/* Card 1: 信号描述 */}
          <section className="drawer-card">
            <h3>📖 缠论形态判定定义</h3>
            <p className="drawer-desc-text">{bspMeta.desc}</p>
            <div className="drawer-grid-2">
              <div>
                <span className="drawer-label">触发时间</span>
                <strong className="tnum">{formatDateTime(signal.signalTime)}</strong>
              </div>
              <div>
                <span className="drawer-label">触发价格</span>
                <strong className="tnum">{price !== null ? price.toFixed(2) : "-"}</strong>
              </div>
            </div>
          </section>

          {/* Card 2: 中枢几何形态 */}
          <section className="drawer-card">
            <h3>📐 关联中枢区间几何 (ZG / ZD / GG / DD)</h3>
            {zg !== null || zd !== null ? (
              <div className="drawer-zhongshu-grid">
                <div className="metric-box">
                  <span className="metric-title">中枢上沿 (ZG)</span>
                  <span className="metric-val tnum">{zg !== null ? zg.toFixed(2) : "-"}</span>
                </div>
                <div className="metric-box">
                  <span className="metric-title">中枢下沿 (ZD)</span>
                  <span className="metric-val tnum">{zd !== null ? zd.toFixed(2) : "-"}</span>
                </div>
                <div className="metric-box">
                  <span className="metric-title">中枢最高 (GG)</span>
                  <span className="metric-val tnum">{gg !== null ? gg.toFixed(2) : "-"}</span>
                </div>
                <div className="metric-box">
                  <span className="metric-title">中枢最低 (DD)</span>
                  <span className="metric-val tnum">{dd !== null ? dd.toFixed(2) : "-"}</span>
                </div>
              </div>
            ) : (
              <p className="strategy-muted">该信号为二类点或非中枢离开点，未关联单一中枢区间。</p>
            )}

            {zg !== null && zd !== null && (
              <div className="drawer-calc-box">
                <span>中枢区间宽度 (ZG - ZD)：{(zg - zd).toFixed(2)}</span>
                <span className="status-success">
                  公共重叠有效 (ZG &gt; ZD)：{zg > zd ? "✓ 有效中枢" : "✗ 交集失效"}
                </span>
              </div>
            )}
          </section>

          {/* Card 3: 原始 Context 快照 */}
          <section className="drawer-card">
            <h3>🔬 原始上下文快照 (Context Snapshot)</h3>
            <pre className="json-box">{JSON.stringify(signal.contextSnapshot ?? {}, null, 2)}</pre>
          </section>

          {/* Card 4: 规则定义快照 */}
          <section className="drawer-card">
            <h3>📜 规则定义快照 (Rule Snapshot)</h3>
            <pre className="json-box">{JSON.stringify(signal.ruleSnapshot ?? {}, null, 2)}</pre>
          </section>
        </div>
      </div>
    </div>
  );
}
