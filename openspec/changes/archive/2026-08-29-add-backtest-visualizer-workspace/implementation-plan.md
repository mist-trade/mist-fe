# Implementation Plan: mist-fe 回测可视化工作台

## Phase 1: API 客户端补齐与类型扩展
1. 在 `mist-fe/app/api/types.ts` 中补充 `IFetchDuan`、`IFetchDuanChannel`、`IFetchDuanChannelPhases` 及买卖点相关的类型定义。
2. 在 `mist-fe/app/api/client.ts` 中导出 `fetchDuan`、`fetchDuanChannel`、`normalizeDuanChannelPhases` 及其严谨的 envelope 校验方法。
3. 扩展 `client.test.ts` 确保全量契约通过单元测试。

## Phase 2: 图表底层能力升级与图元扩展
1. 在 `mist-fe/app/components/k-panel/types/index.ts` 中加入买卖点信号映射类型 `BspSignalMappedData`、线段 `DuanMappedData`、段中枢 `DuanChannelMappedData`。
2. 在 `dataProcessor.ts` 中实现线段、段中枢及买卖点信号占位符生成与坐标映射。
3. 在 `useChartConfig.ts` 中扩展 `createDuanSeries`、`createDuanChannelSeries`、`createBspSeries` 以及 MACD 计算与副图渲染。
4. 编写图表数据处理的单元测试 `k-panel/__tests__/dataProcessor.test.ts`。

## Phase 3: 回测工作台组件研发与路由构建
1. 在 `mist-fe/app/backtests/components/` 构建：
   - `BacktestConfigPanel.tsx`: 回测参数配置（带时分秒的时间选择器、策略版本选择、标的快速输入、周期与数据源）。
   - `BacktestRunHistory.tsx`: 历史回测任务列表，展示运行状态、耗时与信号统计。
   - `BacktestSignalTable.tsx`: 信号结果明细列表（支持点击聚焦）。
   - `ChanDiagnosisDrawer.tsx`: 缠论中枢与背驰诊断抽屉（展示 ZG/ZD/GG/DD、MACD 力度比对与原始上下文）。
2. 在 `mist-fe/app/backtests/BacktestWorkspace.tsx` 组装工作台，整合轮询、图表渲染与联动。
3. 在 `mist-fe/app/backtests/page.tsx` 创建 `/backtests` 路由入口。

## Phase 4: 全局导航同步、样式调优与测试验收
1. 在 `mist-fe/app/layout.tsx`、`/k`、`/strategies`、`/settings/realtime-subscriptions` 等页面的 Navigation 中同步加入 `回测` 入口。
2. 在 `mist-fe/app/globals.css` 中补齐回测面板与诊断抽屉的自适应样式与无障碍 Token。
3. 编写完整的组件与页面单元测试 `app/backtests/__tests__/BacktestWorkspace.test.tsx`。
4. 运行 `pnpm typecheck`、`pnpm test` 与 `pnpm build` 验收，确保 100% 通过。
