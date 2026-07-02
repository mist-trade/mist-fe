import * as echarts from "echarts/core";
import { useEffect, useRef } from "react";

interface UseChartRenderProps {
  setOption: (chart: echarts.ECharts) => void;
  isEnabled: boolean;
}

export function useChartRender({ setOption, isEnabled }: UseChartRenderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const myChart = echarts.init(container);
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
  }, []);

  useEffect(() => {
    if (chartRef.current && isEnabled) {
      setOption(chartRef.current);
    }
  }, [setOption, isEnabled]);

  return containerRef;
}
