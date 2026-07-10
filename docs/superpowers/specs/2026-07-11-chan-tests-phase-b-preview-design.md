# Chan Tests Phase A/B Preview Design

**Date:** 2026-07-11
**Status:** Approved for planning

## Goal

Show the latest two-stage Chan Bi result on `/chan-tests` using the existing real TDX snapshots. Users can switch between Phase A and Phase B and see the Bi-count reduction without changing the shared KPanel rendering implementation.

## Current State

- `/chan-tests` reads static snapshot files generated on 2026-07-08.
- Each `bi.json` is currently a plain Bi array, so the page cannot represent `{ phaseA, phaseB }`.
- The running `/api/chan` proxy still targets a backend that returns the legacy array response. The preview must therefore remain snapshot-driven and must not depend on deploying the new backend first.
- KPanel accepts one `IFetchBi[]` layer. Extending KPanel to render two Bi layers would expand risk into the production `/k` page.

## Chosen Approach

Add a Phase A/Phase B selector to the existing single chart.

- Default selection: **Phase B**.
- Phase A shows the state-machine output, including retained Invalid Bi values.
- Phase B shows the fixed-point invalid-span reduction result.
- The statistics panel displays both Phase A and Phase B Bi counts so the reduction remains visible while switching.
- KPanel continues to receive exactly one `IFetchBi[]`; no shared chart API or rendering layer changes.

Rejected alternatives:

- **Phase B only:** smallest change, but does not let users understand what the reduction consumed.
- **Two charts or overlaid Bi layers:** visually richer, but duplicates a large chart or changes KPanel internals and makes comparison/rollback harder.

## Snapshot Contract

The canonical `bi.json` payload becomes:

```json
{
  "phaseA": [],
  "phaseB": []
}
```

Frontend types:

```ts
export interface SnapshotBiData {
  phaseA: unknown[];
  phaseB: unknown[];
}
```

Backward compatibility:

- When `bi.json` is a legacy array, normalize it to `{ phaseA: array, phaseB: array }`.
- When it is an object, require both arrays; malformed data makes that snapshot unavailable through the existing `readSnapshot` error path.
- Keep `stats.biCount` as the Phase B count for compatibility with old metadata readers.
- Add optional `stats.phaseABiCount` and `stats.phaseBBiCount`; the UI falls back to the legacy `biCount` label when they are absent.

The snapshot generator accepts both backend response shapes, writes the canonical object, and records all three counts.

## UI and Data Flow

```text
bi.json array/object
  -> readSnapshot normalizes SnapshotBiData
  -> snapshotToChart normalizes Phase A and Phase B Bi fields
  -> ChanTestsPage selects phaseB by default
  -> KPanel receives the selected IFetchBi[]
```

The selector lives beside the page title/selected-case context and uses two accessible buttons with `aria-pressed`:

- `Phase A 原始`
- `Phase B 归约`

The active button uses the page's existing blue selected styling. Changing test cases preserves the selected phase. Empty phase arrays render the K chart without Bi lines rather than treating the snapshot as missing.

## Latest Snapshot Data

Regenerate all four registered Chan test cases with the current backend algorithm. Prefer running the local chan app from the current `mist` feature branch and pointing `SNAPSHOT_BACKEND_URL` at it. If local database-backed endpoints are unavailable, deterministically recalculate only `{ phaseA, phaseB }` from the already committed `merge-k.json` files using the current `BiService`; retain the existing K, merge-K, fenxing, and channel snapshots.

The default Shanghai-index case must visibly include:

- Phase A: retained `2024-10-07 -> 2024-10-15 down Invalid`.
- Phase B: `2024-10-07 -> 2025-01-12 down Valid`.

## Error Handling

- Legacy snapshots remain usable through normalization.
- Malformed Phase A/B payloads use the existing unavailable-snapshot state.
- No live request or refresh control is added, so backend/network failures cannot break page rendering.
- The snapshot timestamp and backend URL remain visible provenance; locally recomputed Bi data updates the snapshot generation timestamp.

## Testing and Acceptance

- Unit-test legacy-array and canonical-object normalization.
- Unit-test conversion of both Phase arrays into normalized `IFetchBi[]` values.
- Component-test that Phase B is selected by default and clicking Phase A changes the Bi array passed to KPanel.
- Verify existing snapshot/page tests, frontend typecheck, lint, and production build.
- Browser acceptance at `http://localhost:3000/chan-tests`:
  - Phase A/B controls are visible and unique.
  - Default Phase B and both count statistics are visible.
  - Switching phases updates the selected state and chart without console errors.
  - The Shanghai case uses the newly generated Phase A/B snapshot.

## Non-Goals

- No changes to KPanel's public props or ECharts series implementation.
- No live backend refresh button.
- No mist-skills compatibility work in this change.
- No nested merge, valid-only merge, or algorithm changes in the frontend.
