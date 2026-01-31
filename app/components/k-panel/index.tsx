"use client";
import {
  BiType,
  IFetchBi,
  IFetchK,
  IMergeK,
  TrendDirection,
} from "@/app/api/fetch";
import * as echarts from "echarts";
import { use, useEffect, useRef } from "react";

interface KPanelProps {
  k: IFetchK[];
  mergeK: Promise<IMergeK[]>;
  bi: Promise<IFetchBi[]>;
}

// 定义 MergeK 矩形的类型
interface MergeRect {
  startIndex: number;
  endIndex: number;
  highest: number;
  lowest: number;
  trend: TrendDirection;
}

// 定义 Bi 数据的类型
interface BiMappedData {
  startIndex: number;
  endIndex: number;
  startPrice: number;
  endPrice: number;
  trend: TrendDirection;
  type: BiType;
  independentCount: number;
  originData: IFetchK[];
  highest: number;
  lowest: number;
}

// 定义 Bi 样式类型
interface BiStyle {
  lineWidth: number;
  lineDash: number[];
  opacity: number;
}

// 定义 ECharts 自定义系列图形元素类型
type EChartsGraphicElement =
  | { type: "group"; children: EChartsGraphicElement[]; z?: number }
  | {
      type: "line";
      shape: { x1: number; y1: number; x2: number; y2: number };
      style: Record<string, unknown>;
      z?: number;
    }
  | {
      type: "circle";
      shape: { cx: number; cy: number; r: number };
      style: Record<string, unknown>;
      z?: number;
    }
  | {
      type: "text";
      shape: { x: number; y: number };
      style: Record<string, unknown>;
      z?: number;
    }
  | {
      type: "rect";
      shape: { x: number; y: number; width: number; height: number };
      style: Record<string, unknown>;
      z?: number;
    };

function KPanel(props: KPanelProps) {
  const k = props.k;
  const mergeK = use(props.mergeK);
  const bi = use(props.bi);
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  // 根据 BiType 获取颜色
  const getBiColor = (type: BiType): string => {
    switch (type) {
      case BiType.Initial: // 初始笔
        return "#ff9800"; // 橙色
      case BiType.UnComplete: // 未完成笔
        return "#9c27b0"; // 紫色
      case BiType.Complete: // 完成笔
        return "#2196f3"; // 蓝色
      default:
        return "#666"; // 默认灰色
    }
  };

  // 根据 TrendDirection 获取样式
  const getBiStyle = (trend: TrendDirection): BiStyle => {
    switch (trend) {
      case TrendDirection.Up:
        return {
          lineWidth: 2,
          lineDash: [], // 实线
          opacity: 1,
        };
      case TrendDirection.Down:
        return {
          lineWidth: 2,
          lineDash: [5, 3], // 虚线
          opacity: 1,
        };
      case TrendDirection.None:
        return {
          lineWidth: 1,
          lineDash: [2, 2], // 点线
          opacity: 0.6,
        };
      default:
        return {
          lineWidth: 2,
          lineDash: [],
          opacity: 1,
        };
    }
  };

  const setOption = () => {
    // 准备数据
    const dates = k.map((item) => {
      const date = new Date(item.time);
      return `${date.getMonth() + 1}/${date.getDate()}`;
    });
    const klineData = k.map((item) => [
      item.open,
      item.close,
      item.lowest,
      item.highest,
    ]);
    const volumes = k.map((item) => item.amount);

    // 计算 K 线数据的最小值和最大值，用于 y 轴自适应
    const prices = k.flatMap((item) => [
      item.highest,
      item.lowest,
      item.open,
      item.close,
    ]);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice;

    // 准备 mergeK 矩形数据
    const mergedKIndices = new Set<number>();
    const mergeKRects: MergeRect[] = mergeK
      .map((merge) => {
        const startTime = new Date(merge.startTime);
        const endTime = new Date(merge.endTime);

        const startIndex = k.findIndex((item) => {
          const kTime = new Date(item.time);
          return kTime.getTime() === startTime.getTime();
        });

        const endIndex = k.findIndex((item) => {
          const kTime = new Date(item.time);
          return kTime.getTime() === endTime.getTime();
        });

        if (startIndex === -1 || endIndex === -1) {
          return null;
        }

        if (endIndex > startIndex) {
          for (let i = startIndex; i <= endIndex; i++) {
            mergedKIndices.add(i);
          }
          return {
            startIndex,
            endIndex,
            highest: merge.highest,
            lowest: merge.lowest,
            trend: merge.trend,
          };
        }

        return null;
      })
      .filter((item): item is MergeRect => item !== null);

    // 准备 Bi 数据 - 将笔映射到 K 线的索引
    const biData: BiMappedData[] = bi
      .map((b) => {
        const startTime = new Date(b.startTime);
        const endTime = new Date(b.endTime);

        const startIndex = k.findIndex((item) => {
          const kTime = new Date(item.time);
          return kTime.getTime() === startTime.getTime();
        });

        const endIndex = k.findIndex((item) => {
          const kTime = new Date(item.time);
          return kTime.getTime() === endTime.getTime();
        });

        if (startIndex === -1 || endIndex === -1) {
          return null;
        }

        return {
          startIndex,
          endIndex,
          startPrice: b.trend === TrendDirection.Up ? b.lowest : b.highest,
          endPrice: b.trend === TrendDirection.Up ? b.highest : b.lowest,
          trend: b.trend,
          type: b.type,
          independentCount: b.independentCount,
          originData: b.originData,
          highest: b.highest,
          lowest: b.lowest,
        };
      })
      .filter((item): item is BiMappedData => item !== null);

    // 创建 mergeK 边框系列
    const mergeKBorderSeries: echarts.CustomSeriesOption = {
      name: "mergeK-border",
      type: "custom",
      renderItem: (params, api) => {
        const kIndex = params.dataIndex as number;

        if (!mergedKIndices.has(kIndex)) {
          return null;
        }

        const isInMergeRange = mergeKRects.some(
          (rect) => kIndex >= rect.startIndex && kIndex <= rect.endIndex
        );

        if (!isInMergeRange) {
          return null;
        }

        const item = k[kIndex];
        const open = item.open;
        const close = item.close;
        const lowest = item.lowest;
        const highest = item.highest;

        const highPoint = api.coord([kIndex, highest]) as [number, number];
        const lowPoint = api.coord([kIndex, lowest]) as [number, number];
        const openPoint = api.coord([kIndex, open]) as [number, number];
        const closePoint = api.coord([kIndex, close]) as [number, number];

        const sizeResult = api.size?.([1, 0]) || 20;
        const barWidth = Array.isArray(sizeResult) ? sizeResult[0] : sizeResult;
        const halfBarWidth = barWidth * 0.4;

        const isUp = close > open;
        const color = isUp ? "#ef5350" : "#26a69a";

        const rectTop = Math.min(openPoint[1], closePoint[1]);
        const rectHeight = Math.abs(openPoint[1] - closePoint[1]) || 1;

        return {
          type: "group",
          children: [
            {
              type: "line",
              shape: {
                x1: highPoint[0],
                y1: highPoint[1],
                x2: highPoint[0],
                y2: rectTop,
              },
              style: {
                stroke: color,
                lineWidth: 1.5,
                lineDash: [3, 3],
              },
            },
            {
              type: "line",
              shape: {
                x1: lowPoint[0],
                y1: lowPoint[1],
                x2: lowPoint[0],
                y2: rectTop + rectHeight,
              },
              style: {
                stroke: color,
                lineWidth: 1.5,
                lineDash: [3, 3],
              },
            },
            {
              type: "rect",
              shape: {
                x: highPoint[0] - halfBarWidth,
                y: rectTop,
                width: barWidth * 0.8,
                height: rectHeight,
              },
              style: {
                fill: "transparent",
                stroke: color,
                lineWidth: 1.5,
                lineDash: [3, 3],
              },
            },
          ],
          z: 20,
        };
      },
      data: k.map((_, idx) => idx),
      z: 20,
    };

    // 创建 mergeK 矩形系列
    const mergeKSeries: echarts.CustomSeriesOption = {
      name: "mergeK",
      type: "custom",
      renderItem: (params, api) => {
        const rectIndex = params.dataIndex as number;
        const rect = mergeKRects[rectIndex];

        if (!rect || rect.startIndex === rect.endIndex) {
          return null;
        }

        const startPoint = api.coord([rect.startIndex, rect.highest]) as [
          number,
          number
        ];
        const endPoint = api.coord([rect.endIndex, rect.lowest]) as [
          number,
          number
        ];

        const sizeResult = api.size?.([1, 0]) || 20;
        const barWidth = Array.isArray(sizeResult) ? sizeResult[0] : sizeResult;

        const halfBarWidth = barWidth * 0.4;
        const x = startPoint[0] - halfBarWidth;
        const y = Math.min(startPoint[1], endPoint[1]);
        const width = endPoint[0] - startPoint[0] + barWidth * 0.8;
        const height = Math.abs(startPoint[1] - endPoint[1]);

        return {
          type: "rect",
          shape: {
            x,
            y,
            width,
            height,
          },
          style: {
            fill:
              rect.trend === TrendDirection.Up
                ? "rgba(239, 83, 80, 0.1)"
                : "rgba(38, 166, 154, 0.1)",
            stroke: rect.trend === TrendDirection.Up ? "#ef5350" : "#26a69a",
            lineWidth: 1,
            lineDash: [5, 5],
          },
          z: 5,
        };
      },
      data: mergeKRects.map((_, idx) => idx),
      z: 5,
    };

    // 创建 Bi 连线系列 - 使用自定义系列
    const biSeries: echarts.CustomSeriesOption = {
      name: "Bi",
      type: "custom",
      renderItem: (params, api) => {
        const biIndex = params.dataIndex as number;
        const biItem = biData[biIndex];

        if (!biItem) {
          return null;
        }

        const startPoint = api.coord([
          biItem.startIndex,
          biItem.startPrice,
        ]) as [number, number];
        const endPoint = api.coord([biItem.endIndex, biItem.endPrice]) as [
          number,
          number
        ];

        const color = getBiColor(biItem.type);
        const style = getBiStyle(biItem.trend);

        // 绘制笔的连线
        const line: EChartsGraphicElement = {
          type: "line",
          shape: {
            x1: startPoint[0],
            y1: startPoint[1],
            x2: endPoint[0],
            y2: endPoint[1],
          },
          style: {
            stroke: color,
            lineWidth: style.lineWidth,
            opacity: style.opacity,
            lineDash: style.lineDash,
          },
          z: 10,
        };

        // 绘制起点和终点标记点
        const startMarker: EChartsGraphicElement = {
          type: "circle",
          shape: {
            cx: startPoint[0],
            cy: startPoint[1],
            r: 3,
          },
          style: {
            fill: color,
            stroke: "#fff",
            lineWidth: 1,
          },
          z: 11,
        };

        const endMarker: EChartsGraphicElement = {
          type: "circle",
          shape: {
            cx: endPoint[0],
            cy: endPoint[1],
            r: 3,
          },
          style: {
            fill: color,
            stroke: "#fff",
            lineWidth: 1,
          },
          z: 11,
        };

        // 如果笔较长，可以在中间添加文字标签
        const length = Math.sqrt(
          Math.pow(endPoint[0] - startPoint[0], 2) +
            Math.pow(endPoint[1] - startPoint[1], 2)
        );

        const groupChildren: EChartsGraphicElement[] = [
          line,
          startMarker,
          endMarker,
        ];

        if (length > 50) {
          // 如果线足够长，添加文字标签
          const midX = (startPoint[0] + endPoint[0]) / 2;
          const midY = (startPoint[1] + endPoint[1]) / 2;

          const label: EChartsGraphicElement = {
            type: "text",
            shape: {
              x: midX,
              y: midY,
            },
            style: {
              text: `笔${biIndex + 1}`,
              fill: color,
              fontSize: 10,
              fontWeight: "bold",
              textBackgroundColor: "rgba(255, 255, 255, 0.7)",
              textBorderRadius: 2,
              padding: [2, 4],
            },
            z: 12,
          };

          groupChildren.push(label);
        }

        return {
          type: "group",
          children: groupChildren,
          z: 10,
        };
      },
      data: biData.map((_, idx) => idx),
      z: 10,
    };

    const options: echarts.EChartsOption = {
      title: {
        text: "K线图",
        left: 0,
      },
      legend: {
        data: ["K线", "成交量", "Bi"],
        top: 30,
        selected: {
          Bi: true,
          "mergeK-border": false,
          mergeK: false,
        },
      },
      tooltip: {
        trigger: "axis",
        axisPointer: {
          type: "cross",
        },
        borderWidth: 1,
        borderColor: "#ccc",
        padding: 10,
        textStyle: {
          color: "#000",
        },
        formatter: (params) => {
          // 处理数组情况（多个系列同时触发）
          if (Array.isArray(params)) {
            // 首先检查是否是笔的 tooltip（通过自定义系列触发的）
            const biParam = params.find((p) => p.seriesName === "Bi");
            if (biParam) {
              const biIndex = biParam.dataIndex;
              const b = biData[biIndex];
              if (!b) return "";

              const startDate = dates[b.startIndex];
              const endDate = dates[b.endIndex];
              const priceChange = b.endPrice - b.startPrice;
              const changePercent = (
                (priceChange / b.startPrice) *
                100
              ).toFixed(2);

              return [
                `<div style="font-weight: bold; color: ${getBiColor(
                  b.type
                )}">笔${biIndex + 1}</div>`,
                `类型: ${b.type}`,
                `趋势: ${b.trend}`,
                `起始: ${startDate} (${b.startPrice.toFixed(2)})`,
                `结束: ${endDate} (${b.endPrice.toFixed(2)})`,
                `涨幅: ${priceChange.toFixed(2)} (${changePercent}%)`,
                `独立K线数: ${b.independentCount}`,
                `最高: ${b.highest.toFixed(2)}`,
                `最低: ${b.lowest.toFixed(2)}`,
              ].join("<br/>");
            }

            // 默认 K 线 tooltip
            if (params.length > 0) {
              const dataIndex = params[0].dataIndex;
              const item = k[dataIndex];
              return [
                `日期: ${dates[dataIndex]}`,
                `开盘: ${item.open.toFixed(2)}`,
                `收盘: ${item.close.toFixed(2)}`,
                `最低: ${item.lowest.toFixed(2)}`,
                `最高: ${item.highest.toFixed(2)}`,
                `成交量: ${item.amount.toFixed(0)}`,
              ].join("<br/>");
            }
          }

          // 处理单个参数情况（通常是自定义系列的单独触发）
          if (!Array.isArray(params) && params.seriesName === "Bi") {
            const b = biData[params.dataIndex];
            if (!b) return "";

            const startDate = dates[b.startIndex];
            const endDate = dates[b.endIndex];
            const priceChange = b.endPrice - b.startPrice;
            const changePercent = ((priceChange / b.startPrice) * 100).toFixed(
              2
            );

            return [
              `<div style="font-weight: bold; color: ${getBiColor(b.type)}">笔${
                params.dataIndex + 1
              }</div>`,
              `类型: ${b.type}`,
              `趋势: ${b.trend}`,
              `起始: ${startDate} (${b.startPrice.toFixed(2)})`,
              `结束: ${endDate} (${b.endPrice.toFixed(2)})`,
              `涨幅: ${priceChange.toFixed(2)} (${changePercent}%)`,
              `独立K线数: ${b.independentCount}`,
              `最高: ${b.highest.toFixed(2)}`,
              `最低: ${b.lowest.toFixed(2)}`,
            ].join("<br/>");
          }

          return "";
        },
      },
      axisPointer: {
        link: [{ xAxisIndex: "all" }],
        label: { backgroundColor: "#777" },
      },
      grid: [
        {
          left: "10%",
          right: "8%",
          height: "50%",
        },
        {
          left: "10%",
          right: "8%",
          top: "63%",
          height: "16%",
        },
      ],
      xAxis: [
        {
          type: "category",
          data: dates,
          boundaryGap: true,
          axisLine: { onZero: false },
          splitLine: { show: false },
          min: "dataMin",
          max: "dataMax",
        },
        {
          type: "category",
          gridIndex: 1,
          data: dates,
          boundaryGap: true,
          axisLine: { onZero: false },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          min: "dataMin",
          max: "dataMax",
        },
      ],
      yAxis: [
        {
          scale: true,
          min: Math.max(0, minPrice - priceRange * 0.05),
          max: maxPrice + priceRange * 0.05,
          splitArea: {
            show: true,
          },
        },
        {
          scale: true,
          gridIndex: 1,
          splitNumber: 2,
          axisLabel: { show: false },
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine: { show: false },
          min: 0,
        },
      ],
      dataZoom: [
        {
          type: "inside",
          xAxisIndex: [0, 1],
          start: 0,
          end: 100,
        },
        {
          show: true,
          xAxisIndex: [0, 1],
          type: "slider",
          top: "85%",
          start: 0,
          end: 100,
        },
      ],
      series: [
        {
          name: "K线",
          type: "candlestick",
          data: klineData,
          itemStyle: {
            color: "#ef5350",
            color0: "#26a69a",
            borderColor: "#ef5350",
            borderColor0: "#26a69a",
          },
        },
        mergeKBorderSeries,
        mergeKSeries,
        biSeries, // 使用自定义系列绘制笔
        {
          name: "成交量",
          type: "bar",
          xAxisIndex: 1,
          yAxisIndex: 1,
          data: volumes,
          itemStyle: {
            color: (params: { dataIndex: number }) => {
              const dataIndex = params.dataIndex;
              const kline = klineData[dataIndex];
              return kline[1] > kline[0] ? "#ef5350" : "#26a69a";
            },
          },
        },
      ],
    };
    chartRef.current?.setOption(options);
  };

  useEffect(() => {
    if (!containerRef.current) return;
    const myCharts = echarts.init(containerRef.current);
    chartRef.current = myCharts;
    setOption();

    return () => {
      chartRef.current?.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (chartRef.current && k.length > 0 && mergeK.length > 0) {
      setOption();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k, mergeK, bi]);

  useEffect(() => {
    const handleResize = () => {
      chartRef.current?.resize();
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      id="k-panel"
      style={{ width: "100%", height: 600 }}
    ></div>
  );
}

export default KPanel;
