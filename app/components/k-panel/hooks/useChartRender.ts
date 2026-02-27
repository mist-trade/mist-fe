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
    if (!containerRef.current) return;

    const myChart = echarts.init(containerRef.current);
    chartRef.current = myChart;

    return () => {
      chartRef.current?.dispose();
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
