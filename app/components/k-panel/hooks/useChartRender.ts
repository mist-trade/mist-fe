import * as echarts from "echarts/core";
import { useEffect, useRef } from "react";
import { useThemeName } from "@/app/styles/ThemeProvider";
import {
  registerMistThemes,
  themeNameToEcharts,
} from "@/app/components/charts/echarts-theme";

interface UseChartRenderProps {
  setOption: (chart: echarts.ECharts) => void;
  isEnabled: boolean;
}

/**
 * 创建并管理 ECharts 实例：
 *  - 用当前主题初始化（echarts.init(container, themeName)）
 *  - 主题切换时 dispose + 用新主题重建，保证 tooltip/网格/legend 全跟随
 *  - ResizeObserver 响应容器尺寸
 *  - 卸载时 dispose
 */
export function useChartRender({ setOption, isEnabled }: UseChartRenderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const themeName = useThemeName();
  // 保留最新的 setOption，供重建后重绘使用
  const setOptionRef = useRef(setOption);
  useEffect(() => {
    setOptionRef.current = setOption;
  }, [setOption]);

  // 注册主题（客户端幂等）
  useEffect(() => {
    registerMistThemes();
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const myChart = echarts.init(container, themeNameToEcharts(themeName));
    chartRef.current = myChart;
    const resizeObserver = new ResizeObserver(() => {
      myChart.resize();
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      myChart.dispose();
      chartRef.current = null;
    };
  }, [themeName]); // 主题变化时重建实例

  useEffect(() => {
    if (chartRef.current && isEnabled) {
      setOption(chartRef.current);
    }
  }, [setOption, isEnabled]);

  return containerRef;
}
