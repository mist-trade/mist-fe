# Chan Channel Phase A/B Preview Design

**Date:** 2026-07-15
**Status:** Implemented and verified

## Goal

Carry the backend Channel two-phase result through the live K-line page and the
Chan snapshot console without making deployment order brittle.

## Contract

The HTTP endpoint uses the standard API envelope; its `data` payload and the
standalone `channel.json` shape are:

```json
{
  "phaseA": [],
  "phaseB": []
}
```

Phase A contains every detected base channel with `Valid` or `Invalid` status.
Phase B contains the Valid fixed-point result after constrained span reduction.

Frontend API and snapshot loaders also accept a legacy bare array and normalize
it to `{ phaseA: array, phaseB: array }`. Objects missing either phase are
rejected rather than partially rendered.

## Rendering

- The production `/k` page renders Channel Phase B.
- The `/chan-tests` phase selector applies to both Bi and Channel overlays.
- Statistics preserve `channelCount` as the Phase B count and add
  `phaseAChannelCount` and `phaseBChannelCount`.

## Fixtures

The four real TDX fixtures remain owned by `mist-fe`. Offline generation reads
each committed `merge-k.json`, calls the backend repository's Bi and Channel
export tools, and writes canonical phase objects. Backend unit tests use only
synthetic data and do not require a sibling frontend checkout.

The earlier 2026-07-11 Bi preview documents remain historical records; this
document extends the current contract to Channel rather than rewriting them.
