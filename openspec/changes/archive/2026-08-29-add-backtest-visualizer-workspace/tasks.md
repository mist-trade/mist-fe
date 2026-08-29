# Tasks: mist-fe 回测可视化工作台系统

## 1. API 客户端与类型补齐

- [x] 1.1 `[mist-fe]` 在 `app/api/types.ts` 中增补 `IFetchDuan`、`IFetchDuanChannel`、`IFetchDuanChannelPhases`。
- [x] 1.2 `[mist-fe]` 在 `app/api/client.ts` 中封装 `fetchDuan`、`fetchDuanChannel` 及 `normalizeDuanChannelPhases`。
- [x] 1.3 `[mist-fe]` 编写 `app/api/__tests__/client.test.ts` 契约单元测试。

## 2. 图表层多维度图元与买卖点标记扩展

- [x] 2.1 `[mist-fe]` 在 `app/components/k-panel/types/index.ts` 中定义 `BspSignalMappedData`、`DuanMappedData`、`DuanChannelMappedData`。
- [x] 2.2 `[mist-fe]` 在 `app/components/k-panel/utils/dataProcessor.ts` 中实现线段、段中枢、买卖点信号及 MACD 指标计算。
- [x] 2.3 `[mist-fe]` 在 `app/components/k-panel/hooks/useChartConfig.ts` 中实现买卖点 Pins、线段、段中枢与 MACD 副图的 ECharts 系列。
- [x] 2.4 `[mist-fe]` 编写 `app/components/k-panel/__tests__/dataProcessor.test.ts` 单元测试。

## 3. 回测工作台页面与诊断组件研发

- [x] 3.1 `[mist-fe]` 实现 `app/backtests/components/BacktestConfigPanel.tsx`（支持精确时分秒的日期时间选择与参数配置）。
- [x] 3.2 `[mist-fe]` 实现 `app/backtests/components/BacktestRunHistory.tsx` 与运行状态轮询。
- [x] 3.3 `[mist-fe]` 实现 `app/backtests/components/BacktestSignalTable.tsx`，支持点击信号联动图表居中聚焦。
- [x] 3.4 `[mist-fe]` 实现 `app/backtests/components/ChanDiagnosisDrawer.tsx`，展示中枢几何 (ZG/ZD/GG/DD)、MACD 力度背驰对比与原始 JSON。
- [x] 3.5 `[mist-fe]` 组装 `app/backtests/BacktestWorkspace.tsx` 与 `app/backtests/page.tsx`。

## 4. 全局导航同步与样式验收

- [x] 4.1 `[mist-fe]` 同步更新全局导航栏，在 `K 线`、`策略`、`回测`、`实时订阅` 间平滑切换。
- [x] 4.2 `[mist-fe]` 在 `app/globals.css` 中注入回测工作台样式与自适应断点。
- [x] 4.3 `[mist-fe]` 编写 `app/backtests/__tests__/BacktestWorkspace.test.tsx` 测试套件。
- [x] 4.4 `[mist-fe]` 执行 `pnpm typecheck`、`pnpm test` 与 `pnpm build` 全绿验证。

