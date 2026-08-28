# Spec Delta: backtest-visualizer-workspace（双请求对齐修复）

> 旧 Change `add-backtest-visualizer-workspace` 的 `specs/backtest-visualizer-workspace/spec.md` 目前为非标准结构（`# 2.1/3.x` 小节），未按 `Requirement/Scenario` 规范化。直接以 `MODIFIED` 覆盖旧 Requirement 会因结构缺失导致 `openspec archive` 校验失败。本 delta 以 `ADDED` 固化双请求契约，旧 Spec 的全量场景在归档时手工合入 live spec（`--skip-specs` 后手合）。

## ADDED Requirements

### Requirement: 可视化双请求同参并发且时分秒精度

前端在 `/k` 与 `/backtests` 的 K 线与缠论几何渲染必须以**同一 query** 同参并发双请求，且保留时分秒精度。

#### Scenario: 同参并发且精度保留
- **WHEN** 前端在 `/k` 或 `/backtests` 渲染 K 线与缠论几何
- **THEN** 必须以同一 query `{code, period, source, startDate, endDate}` 并发请求 `fetchK`（`POST /v1/indicators/k`）与 `fetchVisualCommands`（`GET /v1/visual/commands`）
- **AND** `startDate/endDate` 必须保留时分秒精度（如 `YYYY-MM-DD HH:MM:SS` 或 ISO），不再 `substring(0,10)` 截断；统一经 `app/lib/time.ts` 的 `Asia/Shanghai` 转换，与后端的 `TimezoneService.parseDateString` 语义一致
- **AND** 旧的 7 请求碎片化契约（`fetchMergeK/fetchBi/fetchFenxing/fetchChannel/fetchDuan/fetchDuanChannel`）不再作为主路径契约，仅作为 `chan` 调试/回归用途保留（可选）

### Requirement: 双请求时间轴对齐不变量

`TradingViewChart` 以 `{k, commands}` 合并渲染时，几何时间必须能在 K 序列中命中，否则视为契约破坏。

#### Scenario: 笔段中枢贴线
- **WHEN** `TradingViewChart` 以 `{k, commands}` 合并渲染
- **THEN** `commands` 中所有时间字段（`Line: startTime/endTime`、`Band: fromTime/toTime`、`Text: time`）必须能在 `k[].time` 序列中经 `getKIndex` 命中
- **AND** 未命中不得回退到索引 `0`；未命中即视为契约破坏
- **AND** `KPriceProjector`/`Number()` 的容错策略在前后端一致，不允许一端静默丢弃一端透传

## 归档说明（旧 Spec 场景迁移）

旧 `add-backtest-visualizer-workspace` 的 `2.1/3.x` 小节将在归档时手工规范化为标准 `Requirement` 并合入 live spec，本 Change 不以 `MODIFIED` 覆盖旧文件：
- 2.1 `7 请求` → 修正为 `双请求同参并发`
- 3.2 `多图层渲染` → 保留并补充 `getKIndex` 对齐不变量作为验收门禁

> 归档命令：`openspec archive fix-dual-request-visual-alignment --skip-specs` 后手工合入 `openspec/specs/backtest-visualizer-workspace/spec.md`（若届时已提升为 live）。
