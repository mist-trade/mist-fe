# Spec Delta: web-visualization（mist-fe 侧镜像）

> 镜像 `mist` 仓 `web-visualization` 的双请求对齐约束，确保跨仓一致。前端消费侧以 `fetchK + fetchVisualCommands` 同参并发为准。

## ADDED Requirements

### Requirement: 前端双请求同参并发且时分秒精度

#### Scenario: 同参并发且精度保留
- **WHEN** `KLineLivePage` 或 `BacktestWorkspace` 并发请求 `fetchK` 与 `fetchVisualCommands`
- **THEN** 必须传入同一 `{code, period, source, startDate, endDate}`，且 `startDate/endDate` 保留时分秒精度，不做 `substring(0,10)` 截断
- **AND** 时间统一经 `app/lib/time.ts`（`Asia/Shanghai`）处理

#### Scenario: 后端 count 裁剪已移除
- **WHEN** 前端请求 `GET /v1/visual/commands`
- **THEN** 不得依赖默认 `count=500` 的尾部裁剪对齐；查询以时间窗口为唯一真源
