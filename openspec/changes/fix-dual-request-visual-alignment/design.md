# Design: 双请求可视化对齐修复（mist-fe 侧）

## 现状
```
BacktestWorkspace.loadChartForRun:
  Promise.all([
    fetchK({ startDate: run.startDate.substring(0,10), endDate: run.endDate.substring(0,10) }),
    fetchVisualCommands({ startDate: run.startDate.substring(0,10), endDate: run.endDate.substring(0,10) }),
  ])
  → TradingViewChart { k, commands }
```

## 目标
- `startDate/endDate` 不再 `substring(0,10)`，改为经 `app/lib/time.ts` 保留时分秒精度（`YYYY-MM-DD HH:MM:SS` 或 ISO），与后端的 `parseDateString` 语义一致。
- `K` 与 `Visual` 的 `Number()`/`KPriceProjector` 容错一致；`TradingViewChart` 对 `k` 的 `volume/amount` 回退与 Visual 的 `Band` 字段对齐。
- `count` 不再作为隐式裁剪参数；如需分页另行设计。

## 不变量
- `k[].time` 与 `commands[].*Time` 的时间戳必须在同一 `getKIndex` 映射下可命中，否则视为契约破坏。
