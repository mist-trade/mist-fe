"use client";

import React, { useMemo } from "react";
import type { StrategyBacktestSignalResult } from "@/app/api/client";
import type { IFetchK } from "@/app/api/types";
import { formatShanghaiDateTime } from "@/app/lib/time";

export interface SignalIndexItem {
  signal: StrategyBacktestSignalResult;
  index: number;
}

export interface BacktestReplayBarProps {
  isReplayMode: boolean;
  onToggleReplayMode: (active: boolean) => void;
  cursorIndex: number;
  totalBars: number;
  currentBar: IFetchK | null;
  signalIndices: SignalIndexItem[];
  onStepPrev: () => void;
  onStepNext: () => void;
  onJumpFirst: () => void;
  onJumpLast: () => void;
  onJumpPrevSignal: () => void;
  onJumpNextSignal: () => void;
  onSeek: (index: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  playSpeed: number;
  onChangeSpeed: (speed: number) => void;
  onOpenDiagnosis?: () => void;
}

function getSignalLabel(signal: StrategyBacktestSignalResult): { label: string; isSell: boolean } {
  const ctx = (signal.contextSnapshot || {}) as Record<string, unknown>;
  const rawType = String(ctx.type || ctx.signalKind || "signal");
  const isSell = rawType.includes("sell") || rawType === "exit";

  let label = "买点";
  if (rawType === "first_buy") label = "1买";
  else if (rawType === "first_sell") label = "1卖";
  else if (rawType === "second_buy") label = "2买";
  else if (rawType === "second_sell") label = "2卖";
  else if (rawType === "third_buy") label = "3买";
  else if (rawType === "third_sell") label = "3卖";

  return { label, isSell };
}

export function BacktestReplayBar({
  isReplayMode,
  onToggleReplayMode,
  cursorIndex,
  totalBars,
  currentBar,
  signalIndices,
  onStepPrev,
  onStepNext,
  onJumpFirst,
  onJumpLast,
  onJumpPrevSignal,
  onJumpNextSignal,
  onSeek,
  isPlaying,
  onTogglePlay,
  playSpeed,
  onChangeSpeed,
  onOpenDiagnosis,
}: BacktestReplayBarProps) {
  const hasPrevSignal = useMemo(
    () => signalIndices.some((s) => s.index < cursorIndex),
    [signalIndices, cursorIndex]
  );
  const hasNextSignal = useMemo(
    () => signalIndices.some((s) => s.index > cursorIndex),
    [signalIndices, cursorIndex]
  );

  const activeSignalItem = useMemo(
    () => signalIndices.find((s) => s.index === cursorIndex),
    [signalIndices, cursorIndex]
  );

  const passedSignalsCount = useMemo(
    () => signalIndices.filter((s) => s.index <= cursorIndex).length,
    [signalIndices, cursorIndex]
  );

  const activeSignalMeta = activeSignalItem ? getSignalLabel(activeSignalItem.signal) : null;

  return (
    <section className="backtest-replay-bar" aria-label="回测单步复盘控制器">
      {/* 顶部控制与状态栏 */}
      <div className="replay-top-row">
        {/* 左侧：模式切换开关与当前游标指标 */}
        <div className="replay-mode-group">
          <button
            type="button"
            className={`replay-mode-btn ${!isReplayMode ? "active" : ""}`}
            onClick={() => onToggleReplayMode(false)}
            title="查看回测区间全量走势与全局终态缠论结构"
          >
            🌐 全景视角
          </button>
          <button
            type="button"
            className={`replay-mode-btn ${isReplayMode ? "active" : ""}`}
            onClick={() => onToggleReplayMode(true)}
            title="开启单步推演复盘：逐根 K 线观察买卖点触发与缠论笔/段/中枢递进"
          >
            ⏮ 单步复盘模式
          </button>

          {isReplayMode && currentBar && (
            <div className="replay-cursor-info">
              <span className="info-tag tnum">
                K线: {cursorIndex + 1} / {totalBars}
              </span>
              <span className="info-tag tnum">
                {formatShanghaiDateTime(currentBar.time)}
              </span>
              <span className="info-tag tnum">
                收盘: ¥{Number(currentBar.close).toFixed(2)}
              </span>
            </div>
          )}
        </div>

        {/* 右侧：买卖点状态与快捷下钻 */}
        <div className="replay-signal-status">
          {isReplayMode && (
            <>
              {activeSignalMeta ? (
                <div
                  className={`active-signal-badge ${
                    activeSignalMeta.isSell ? "sell" : "buy"
                  }`}
                  onClick={onOpenDiagnosis}
                  role="button"
                  tabIndex={0}
                  title="点击查看此买卖点的缠论中枢与背驰下钻诊断"
                >
                  <span className="signal-pulse" />
                  🎯 触发 {activeSignalMeta.label}
                  {onOpenDiagnosis && <span className="open-hint">🔍 查看诊断</span>}
                </div>
              ) : (
                <span className="replay-signal-progress tnum">
                  信号进度: {passedSignalsCount} / {signalIndices.length}
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {/* 中部：操作按键条（仅在复盘模式下激活交互） */}
      {isReplayMode ? (
        <div className="replay-controls-row">
          {/* 单步推演控制组 */}
          <div className="btn-cluster" role="group" aria-label="单步步进控制">
            <button
              type="button"
              className="replay-btn"
              onClick={onJumpFirst}
              disabled={cursorIndex === 0}
              title="跳转至回测起始 K 线 (快捷键: Home)"
            >
              |◀ 起始
            </button>
            <button
              type="button"
              className="replay-btn"
              onClick={onStepPrev}
              disabled={cursorIndex === 0}
              title="回退 1 根 K 线 (快捷键: [ 或 ←)"
            >
              ◀ 步退
            </button>
            <button
              type="button"
              className={`replay-btn play-btn ${isPlaying ? "playing" : ""}`}
              onClick={onTogglePlay}
              title={isPlaying ? "暂停自动推演 (快捷键: Space)" : "开始自动推演 (快捷键: Space)"}
            >
              {isPlaying ? "⏸ 暂停" : "▶ 播放"}
            </button>
            <button
              type="button"
              className="replay-btn"
              onClick={onStepNext}
              disabled={cursorIndex >= totalBars - 1}
              title="前进 1 根 K 线 (快捷键: ] 或 →)"
            >
              步进 ▶
            </button>
            <button
              type="button"
              className="replay-btn"
              onClick={onJumpLast}
              disabled={cursorIndex >= totalBars - 1}
              title="跳转至回测最新 K 线 (快捷键: End)"
            >
              终点 ▶|
            </button>
          </div>

          {/* 买卖点定向跳转组 */}
          <div className="btn-cluster" role="group" aria-label="买卖点跳转">
            <button
              type="button"
              className="replay-btn signal-jump-btn"
              onClick={onJumpPrevSignal}
              disabled={!hasPrevSignal}
              title="直接跳到上一个买卖点触发时刻 (快捷键: PageUp)"
            >
              ⏮ 上一买卖点
            </button>
            <button
              type="button"
              className="replay-btn signal-jump-btn"
              onClick={onJumpNextSignal}
              disabled={!hasNextSignal}
              title="直接跳到下一个买卖点触发时刻 (快捷键: PageDown)"
            >
              下一买卖点 ⏭
            </button>
          </div>

          {/* 播放速率调节 */}
          <div className="speed-cluster" aria-label="推演速率调节">
            <span className="speed-label">推演速率:</span>
            {[
              { label: "0.5x", value: 1000 },
              { label: "1.0x", value: 500 },
              { label: "2.0x", value: 250 },
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                className={`speed-btn ${playSpeed === item.value ? "active" : ""}`}
                onClick={() => onChangeSpeed(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="replay-shortcuts-hint">
            <span>快捷键: [ 步退 | ] 步进 | 空格 播放 | PgUp/PgDn 切换信号</span>
          </div>
        </div>
      ) : (
        <div className="replay-full-tip">
          <span>当前处于全局全景视角。点击「⏮ 单步复盘模式」或下方买卖点表格，即可逐根切片复盘。</span>
        </div>
      )}

      {/* 底部：时间轴 Scrubber 进度滑块（包含买卖点位置打点） */}
      {isReplayMode && totalBars > 1 && (
        <div className="replay-timeline-wrapper">
          <div className="timeline-track-outer">
            {/* 买卖点在进度条上的彩色刻度点 */}
            <div className="timeline-signal-ticks" aria-hidden="true">
              {signalIndices.map((item) => {
                const pct = ((item.index / (totalBars - 1)) * 100).toFixed(2);
                const { label, isSell } = getSignalLabel(item.signal);
                const isCurrent = item.index === cursorIndex;
                return (
                  <div
                    key={item.signal.id}
                    className={`timeline-tick-dot ${isSell ? "sell" : "buy"} ${
                      isCurrent ? "current" : ""
                    }`}
                    style={{ left: `${pct}%` }}
                    onClick={() => onSeek(item.index)}
                    title={`${label} @ ${formatShanghaiDateTime(item.signal.signalTime)}`}
                  />
                );
              })}
            </div>

            {/* 可拖拽的原生 Range Slider */}
            <input
              type="range"
              className="replay-slider"
              min={0}
              max={totalBars - 1}
              value={cursorIndex}
              onChange={(e) => onSeek(Number(e.target.value))}
              aria-label="回测历史时间游标滑块"
            />
          </div>
        </div>
      )}
    </section>
  );
}

export default BacktestReplayBar;
