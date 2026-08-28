# Tasks: fix-dual-request-visual-alignment（mist-fe 侧）

- [ ] 1. `openspec/changes/fix-dual-request-visual-alignment/specs/backtest-visualizer-workspace/spec.md` 将 2.1 的 7 请求旧契约更新为 `fetchK + fetchVisualCommands` 双请求同参并发，明确时分秒精度与 `app/lib/time.ts` 统一。
- [ ] 2. 补充“双请求对齐不变量”：`commands` 中所有时间字段必须能在 `k` 的 `time` 序列中命中 `getKIndex`，否则为契约破坏。
- [ ] 3. 在实施计划中修复 `BacktestWorkspace` 的 `substring(0,10)` 截断，并对齐 `KPriceProjector`/`Number()` 容错。
- [ ] 4. `openspec validate` 通过后等待二次确认再进实施。
