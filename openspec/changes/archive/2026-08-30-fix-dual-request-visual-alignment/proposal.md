# Proposal: 双请求可视化对齐修复（mist-fe 侧）

> 与 `mist` 仓 `fix-dual-request-visual-alignment` 同一逻辑变更的 `mist-fe` 侧 Spec 镜像。双仓同改，保持契约一致。

## 背景
- `mist-fe` 的 `KLineLivePage` 与 `BacktestWorkspace` 已为双请求并发：`fetchK` + `fetchVisualCommands` 合并渲染于 `TradingViewChart`。
- `BacktestWorkspace` 对 `run.startDate/endDate` 做 `substring(0,10)` 截断，丢失时分秒精度，导致与 `VisualController` 的时间窗口不一致，叠加后端的 `count=500` 裁剪与 `KPriceProjector` 分叉，引发“笔段中枢不贴线”。

## 目标（与 mist 仓 5 决策对齐）
1. 保留双请求；
2. 移除后端的 `count=500 slice(-count)` 裁剪语义，前端不再依赖截断参数对齐；
3. 前端 `KPriceProjector` 容错与后端一致（`Number()`/`KPriceProjector` 统一策略）；
4. 修复 `substring(0,10)` 日期截断 Bug，统一经 `app/lib/time.ts` 的 `Asia/Shanghai` 精确到秒；
5. 与 `mist` 仓 Spec 同步更新。

## 非目标
- 不合并为单聚合接口；不新增 WebSocket。

