import { useCallback, useState } from "react";
import type { VisualCommandVo } from "@/app/api/client";

export function useBacktestChartLayers() {
  // 缠论图层与买卖点显示控制（默认只展示笔折线、笔中枢与回测买卖点；默认隐藏段中枢与原生买卖点）
  const [showBi, setShowBi] = useState<boolean>(true);
  const [showBiZs, setShowBiZs] = useState<boolean>(true);
  const [showDuan, setShowDuan] = useState<boolean>(false);
  const [showDuanZs, setShowDuanZs] = useState<boolean>(false);
  const [showBacktestSignals, setShowBacktestSignals] = useState<boolean>(true);
  const [showChanBsp, setShowChanBsp] = useState<boolean>(false);

  // 按用户选中的图层开关过滤绘图指令集合
  const filterCommandsByLayers = useCallback(
    (cmds: VisualCommandVo[]) => {
      return cmds.filter((cmd) => {
        if (cmd.layer === "chan_bi") return showBi;
        if (cmd.layer === "chan_zs_bi") return showBiZs;
        if (cmd.layer === "chan_duan") return showDuan;
        if (cmd.layer === "chan_zs_duan") return showDuanZs;
        if (cmd.layer === "chan_bsp") return showChanBsp;
        if (cmd.layer === "backtest_signals") return showBacktestSignals;
        return true;
      });
    },
    [showBi, showBiZs, showDuan, showDuanZs, showChanBsp, showBacktestSignals]
  );

  return {
    showBi,
    setShowBi,
    showBiZs,
    setShowBiZs,
    showDuan,
    setShowDuan,
    showDuanZs,
    setShowDuanZs,
    showBacktestSignals,
    setShowBacktestSignals,
    showChanBsp,
    setShowChanBsp,
    filterCommandsByLayers,
  };
}
