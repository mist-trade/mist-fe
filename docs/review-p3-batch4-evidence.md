# Review P3 Batch 4 Evidence

Scope: mist-fe frontend P3 cleanup batch.

Selected items:

- L7, L8, D7, S10
- D3.5, D3.6
- T3.2, T3.3, T3.4, T3.6, T3.7
- M3.1, M3.2, M3.3, M3.4, M3.5
- P3.1, P3.2, P3.3
- A3.2, A3.3
- N3.1
- U3.1, U3.2, U3.3
- X3.1, X3.2, X3.4

Implementation notes:

- Shared `ECOption` from `app/components/k-panel/types/index.ts` instead of defining it in both the panel entry and chart hook.
- Shared `K_PANEL_HEIGHT` for the chart container and skeleton instead of duplicating the 600px height.
- Shared fenxing colors and bar-width extraction instead of repeating inline renderer constants.
- Removed disabled/stale fenxing skip logic and empty midpoint branch from `dataProcessor`.
- Replaced unsafe tooltip params assertion with `isKTooltipParams`.
- Replaced global `parseInt` calls with `Number.parseInt`.
- Renamed the route error boundary class to the exported component name.
- Centralized the security search limit in `KLineLivePage`.

Verification:

- `CI=true pnpm run lint` passed.
- `CI=true pnpm run typecheck` passed.
- `CI=true pnpm exec jest app/components/k-panel/__tests__/dataProcessor.test.ts app/components/k-panel/__tests__/channel.test.ts app/components/k-panel/utils/__tests__/formatters.test.ts app/components/k-panel/hooks/__tests__/useChartData.test.tsx app/k/__tests__/KLineLivePage.test.tsx app/__tests__/route-error-boundaries.test.tsx --runInBand --watchman=false` passed: 6 suites, 48 tests.
- `CI=true pnpm run test:ci` passed: 12 suites, 78 tests.
