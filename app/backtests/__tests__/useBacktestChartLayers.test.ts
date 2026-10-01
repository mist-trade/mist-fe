import { renderHook, act } from "@testing-library/react";
import { useBacktestChartLayers } from "../hooks/useBacktestChartLayers";
import type { VisualCommandVo } from "@/app/api/client";

describe("useBacktestChartLayers", () => {
  it("initializes with default layer states", () => {
    const { result } = renderHook(() => useBacktestChartLayers());

    expect(result.current.showBi).toBe(true);
    expect(result.current.showBiZs).toBe(true);
    expect(result.current.showDuan).toBe(false);
    expect(result.current.showDuanZs).toBe(false);
    expect(result.current.showBacktestSignals).toBe(true);
    expect(result.current.showChanBsp).toBe(false);
  });

  it("filters commands correctly according to active layers", () => {
    const { result } = renderHook(() => useBacktestChartLayers());

    const commands: VisualCommandVo[] = [
      { id: "bi_1", type: "line", layer: "chan_bi" },
      { id: "zs_bi_1", type: "band", layer: "chan_zs_bi" },
      { id: "duan_1", type: "line", layer: "chan_duan" },
      { id: "zs_duan_1", type: "band", layer: "chan_zs_duan" },
      { id: "sig_1", type: "text", layer: "backtest_signals" },
      { id: "bsp_1", type: "text", layer: "chan_bsp" },
      { id: "other_1", type: "line", layer: "other" },
    ];

    // By default: bi, biZs, backtestSignals and other layers are visible
    let filtered = result.current.filterCommandsByLayers(commands);
    expect(filtered.map((c) => c.id)).toEqual(["bi_1", "zs_bi_1", "sig_1", "other_1"]);

    // Enable duan and duanZs
    act(() => {
      result.current.setShowDuan(true);
      result.current.setShowDuanZs(true);
    });

    filtered = result.current.filterCommandsByLayers(commands);
    expect(filtered.map((c) => c.id)).toEqual([
      "bi_1",
      "zs_bi_1",
      "duan_1",
      "zs_duan_1",
      "sig_1",
      "other_1",
    ]);

    // Disable bi
    act(() => {
      result.current.setShowBi(false);
    });

    filtered = result.current.filterCommandsByLayers(commands);
    expect(filtered.map((c) => c.id)).toEqual([
      "zs_bi_1",
      "duan_1",
      "zs_duan_1",
      "sig_1",
      "other_1",
    ]);
  });
});
