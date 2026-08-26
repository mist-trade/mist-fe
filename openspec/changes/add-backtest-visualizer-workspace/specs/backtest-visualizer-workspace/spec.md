# Specification: Backtest Visualizer Workspace

## 1. 概述 (Overview)

Backtest Visualizer Workspace 为 `mist-fe` 提供的交互式回测可视化工作台系统。该系统整合了策略回测任务生命周期、多图层 K 线与缠论几何图元渲染、买卖点信号 Pin 标记、成交量/MACD 动量双模副图、以及中枢与背驰下钻诊断抽屉。

## 2. API 契约需求 (API Contract Requirements)

### 2.1 基础缠论层端点需求
1. 前端客户端 `client.ts` 必须支持：
   - `fetchK(query: KLineQuery): Promise<IFetchK[]>` (`POST /v1/indicators/k`)
   - `fetchMergeK(query: KLineQuery): Promise<IMergeK[]>` (`POST /v1/chan/merge-k`)
   - `fetchFenxing(query: KLineQuery): Promise<IFenxing[]>` (`POST /v1/chan/fenxing`)
   - `fetchBi(query: KLineQuery): Promise<IFetchBiPhases>` (`POST /v1/chan/bi`)
   - `fetchChannel(query: KLineQuery): Promise<IFetchChannelPhases>` (`POST /v1/chan/channel`)
   - `fetchDuan(query: KLineQuery): Promise<IFetchDuan[]>` (`POST /v1/chan/duan`)
   - `fetchDuanChannel(query: KLineQuery): Promise<IFetchDuanChannelPhases>` (`POST /v1/chan/duan-channel`)

### 2.2 回测执行与信号查询
1. `createStrategyBacktest(payload: StrategyBacktestRequest): Promise<StrategyBacktestRun>` (`POST /v1/strategy-backtests`)
2. `fetchStrategyBacktestRun(runId: number): Promise<StrategyBacktestRun>` (`GET /v1/strategy-backtests/:runId`)
3. `fetchStrategyBacktestSignals(runId: number): Promise<StrategyBacktestSignalResult[]>` (`GET /v1/strategy-backtests/:runId/signals`)

## 3. UI 交互与渲染规范 (UI & Interaction Specifications)

### 3.1 时间输入精度
- 回测配置表单必须支持精确到时分秒的时间范围（例如 `2026-08-26 13:00:00` 至 `2026-08-26 15:00:00`）。
- 提交给后端的日期时间必须符合 ISO-8601 格式。

### 3.2 图表多图层渲染
- 必须支持通过图例或开关控制图层的显示与隐藏：
  - K 线 (Candlestick)
  - 成交量 (Volume) / MACD 力度副图 (可 Tab 切换)
  - 包含合并 (MergeK)
  - 分型 (Fenxing)
  - 笔 (Bi)
  - 笔中枢 (Channel / ZG-ZD-GG-DD)
  - 线段 (Duan)
  - 段中枢 (DuanChannel)
  - 买卖点信号标记 (1买/1卖/2买/2卖/3买/3卖 徽标 Pins)

### 3.3 信号表格与图表聚焦
- 点击信号表格中的任意一条记录，图表必须调用 `dispatchAction({ type: 'dataZoom' })` 居中定位至该信号触发的 K 棒，并展示高亮引导。

### 3.4 诊断抽屉
- 选中信号或点击图表上的买卖点徽标时，右侧抽屉展示中枢几何区间（ZG/ZD/GG/DD）、前置一类点关联、MACD 动量衰竭比对及格式化 JSON 快照。
