import { memo } from "react";

interface BacktestLayerToolbarProps {
  showBi: boolean;
  onToggleBi: () => void;
  showBiZs: boolean;
  onToggleBiZs: () => void;
  showDuan: boolean;
  onToggleDuan: () => void;
  showDuanZs: boolean;
  onToggleDuanZs: () => void;
  showBacktestSignals: boolean;
  onToggleBacktestSignals: () => void;
  showChanBsp: boolean;
  onToggleChanBsp: () => void;
}

export const BacktestLayerToolbar = memo(function BacktestLayerToolbar({
  showBi,
  onToggleBi,
  showBiZs,
  onToggleBiZs,
  showDuan,
  onToggleDuan,
  showDuanZs,
  onToggleDuanZs,
  showBacktestSignals,
  onToggleBacktestSignals,
  showChanBsp,
  onToggleChanBsp,
}: BacktestLayerToolbarProps) {
  return (
    <div className="backtest-layer-controls" role="toolbar" aria-label="图层显示控制">
      <div className="layer-controls-left">
        <span className="layer-controls-title">📐 图层展示:</span>
        <div className="layer-toggles-group">
          <button
            type="button"
            className={`layer-toggle-chip ${showBi ? "active" : ""}`}
            onClick={onToggleBi}
            title="笔折线 (Chan Bi)"
          >
            <span className="dot" style={{ background: "#FACC15" }} />
            笔折线
          </button>

          <button
            type="button"
            className={`layer-toggle-chip ${showBiZs ? "active" : ""}`}
            onClick={onToggleBiZs}
            title="笔中枢 (Bi Central)"
          >
            <span
              className="box-icon"
              style={{ borderColor: "#38BDF8", background: "rgba(56, 189, 248, 0.25)" }}
            />
            笔中枢
          </button>

          <button
            type="button"
            className={`layer-toggle-chip ${showDuan ? "active" : ""}`}
            onClick={onToggleDuan}
            title="线段 (Chan Duan)"
          >
            <span className="dot" style={{ background: "#818CF8" }} />
            线段
          </button>

          <button
            type="button"
            className={`layer-toggle-chip ${showDuanZs ? "active" : ""}`}
            onClick={onToggleDuanZs}
            title="段中枢 (Duan Central)"
          >
            <span
              className="box-icon"
              style={{ borderColor: "#818CF8", background: "rgba(129, 140, 248, 0.25)" }}
            />
            段中枢
          </button>

          <button
            type="button"
            className={`layer-toggle-chip ${showBacktestSignals ? "active" : ""}`}
            onClick={onToggleBacktestSignals}
            title="回测策略买卖点标记 (Backtest Signals)"
          >
            <span>🎯</span>
            回测买卖点
          </button>

          <button
            type="button"
            className={`layer-toggle-chip ${showChanBsp ? "active" : ""}`}
            onClick={onToggleChanBsp}
            title="缠论指标原生买卖点 (Raw Chan BSP)"
          >
            <span>⚡</span>
            原生买卖点
          </button>
        </div>
      </div>
    </div>
  );
});
