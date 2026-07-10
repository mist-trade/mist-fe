# Chan Tests Phase A/B Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Make /chan-tests show and switch between the current Chan Bi Phase A candidate sequence and Phase B reduced sequence from reproducible TDX snapshots.

**Architecture:** The frontend snapshot boundary normalizes a legacy Bi array or a canonical object with phaseA and phaseB fields. snapshotToChart converts both sequences, while ChanTestsPage selects exactly one for KPanel's unchanged Bi promise. A small backend CLI derives canonical phase fixtures from committed merge-k.json when a local Chan HTTP service is unavailable, and the frontend generator uses it through an explicit --bi-from-merge-k mode.

**Tech Stack:** Next.js 16, React 19, TypeScript, Jest 30, Testing Library, NestJS TypeScript runtime through ts-node/register.

## Global Constraints

- OpenSpec source of truth: mist/openspec/changes/preview-chan-bi-phases.
- Canonical bi.json is exactly an object containing phaseA and phaseB arrays; a legacy array normalizes to the same array for both phases.
- A canonical object missing either array is unavailable and never partially rendered.
- Phase B is the default selected overlay; KPanel continues to receive one Promise<IFetchBi[]> and has no API or ECharts changes.
- stats.biCount remains the Phase B count; phaseABiCount and phaseBBiCount are optional compatibility additions.
- The fallback derives only Bi data from committed merge-k.json; K, merge-K, fenxing, and channel files remain untouched.
- Do not add a live refresh button, frontend Chan-merge implementation, or mist-skills changes.

---

### Task 1: Normalize and convert phase-aware Bi snapshots

**Files:**
- Modify: mist-fe/app/chan-tests/lib/load-snapshot.ts
- Modify: mist-fe/app/chan-tests/lib/snapshot-to-chart.ts
- Modify: mist-fe/app/chan-tests/ChanTestsPage.tsx
- Create: mist-fe/app/chan-tests/lib/__tests__/load-snapshot.test.ts
- Create: mist-fe/app/chan-tests/lib/__tests__/snapshot-to-chart.test.ts

**Interfaces:**
- Consumes: legacy unknown[] fixture data or canonical object payloads.
- Produces: SnapshotBiData, normalizeSnapshotBiData(value), and ChartData.bi with independently normalized phaseA and phaseB IFetchBi arrays.

- [x] **Step 1: Write failing loader normalization tests**

~~~ts
import { normalizeSnapshotBiData } from "../load-snapshot";

describe("normalizeSnapshotBiData", () => {
  it("uses a legacy array for both phases", () => {
    const legacy = [{ startTime: "2024-10-07T16:00:00.000Z" }];
    expect(normalizeSnapshotBiData(legacy)).toEqual({
      phaseA: legacy,
      phaseB: legacy,
    });
  });

  it("preserves canonical phase arrays", () => {
    expect(normalizeSnapshotBiData({ phaseA: ["a"], phaseB: ["b"] })).toEqual({
      phaseA: ["a"],
      phaseB: ["b"],
    });
  });

  it("rejects a partial canonical object", () => {
    expect(() => normalizeSnapshotBiData({ phaseA: [] })).toThrow(
      "bi.json 必须是数组，或包含 phaseA 和 phaseB 数组的对象"
    );
  });
});
~~~

- [x] **Step 2: Run the loader test before implementation**

Run: pnpm exec jest --runInBand --watchman=false app/chan-tests/lib/__tests__/load-snapshot.test.ts

Expected: FAIL because normalizeSnapshotBiData does not exist.

- [x] **Step 3: Add the typed normalization boundary**

Add to load-snapshot.ts and make SnapshotData.bi use SnapshotBiData:

~~~ts
export interface SnapshotBiData {
  phaseA: unknown[];
  phaseB: unknown[];
}

export function normalizeSnapshotBiData(value: unknown): SnapshotBiData {
  if (Array.isArray(value)) return { phaseA: value, phaseB: value };
  if (
    value &&
    typeof value === "object" &&
    Array.isArray((value as { phaseA?: unknown }).phaseA) &&
    Array.isArray((value as { phaseB?: unknown }).phaseB)
  ) {
    const { phaseA, phaseB } = value as { phaseA: unknown[]; phaseB: unknown[] };
    return { phaseA, phaseB };
  }
  throw new Error("bi.json 必须是数组，或包含 phaseA 和 phaseB 数组的对象");
}
~~~

Make readJson generic over unknown and call normalizeSnapshotBiData(readJson(dir, "bi.json")). Add optional phaseABiCount and phaseBBiCount fields to SnapshotStats.

- [x] **Step 4: Write failing two-phase conversion coverage**

In snapshot-to-chart.test.ts, construct a complete minimal SnapshotData and assert:

~~~ts
const chart = snapshotToChart({
  ...baseSnapshot,
  bi: {
    phaseA: [{ ...baseBi, status: 2 }],
    phaseB: [{ ...baseBi, status: 1, endTime: "2025-01-12T16:00:00.000Z" }],
  },
});

expect(chart.bi.phaseA[0].status).toBe(BiStatus.Invalid);
expect(chart.bi.phaseB[0]).toMatchObject({
  status: BiStatus.Valid,
  endTime: "2025-01-12T16:00:00.000Z",
});
~~~

- [x] **Step 5: Convert each phase through the existing asBi normalizer**

Replace the single Bi array in snapshot-to-chart.ts with:

~~~ts
export interface ChartBiPhases {
  phaseA: IFetchBi[];
  phaseB: IFetchBi[];
}

export interface ChartData {
  k: IFetchK[];
  mergeK: IMergeK[];
  bi: ChartBiPhases;
  fenxing: IFenxing[];
  channel: IFetchChannel[];
}

const bi = {
  phaseA: (snap.bi.phaseA as IFetchBi[]).map(asBi),
  phaseB: (snap.bi.phaseB as IFetchBi[]).map(asBi),
};
~~~

Keep the already-rendered page type-correct before Task 2 adds controls by
changing its existing KPanel call to `bi={Promise.resolve(chart.bi.phaseB)}`.
This preserves the existing one-overlay UI while making Phase B its explicit
default; Task 2 replaces this fixed selection with component state.

- [x] **Step 6: Run the data-boundary tests**

Run: pnpm exec jest --runInBand --watchman=false app/chan-tests/lib/__tests__/load-snapshot.test.ts app/chan-tests/lib/__tests__/snapshot-to-chart.test.ts

Expected: PASS with legacy, canonical, malformed, and two-phase conversion coverage.

- [x] **Step 7: Commit the data-boundary deliverable**

~~~bash
git add app/chan-tests/lib/load-snapshot.ts app/chan-tests/lib/snapshot-to-chart.ts app/chan-tests/lib/__tests__/load-snapshot.test.ts app/chan-tests/lib/__tests__/snapshot-to-chart.test.ts
git commit -m "feat(chan-tests): normalize phase-aware bi snapshots"
~~~

### Task 2: Add the accessible Phase A / Phase B console selector

**Files:**
- Modify: mist-fe/app/chan-tests/ChanTestsPage.tsx
- Modify: mist-fe/app/chan-tests/components/StatsPanel.tsx
- Create: mist-fe/app/chan-tests/__tests__/ChanTestsPage.test.tsx

**Interfaces:**
- Consumes: SnapshotData.bi.phaseA, SnapshotData.bi.phaseB, and optional phase-specific SnapshotStats counts.
- Produces: aria-pressed phase controls and one selected Bi promise for KPanel.

- [x] **Step 1: Write a failing KPanel-probe component test**

~~~tsx
let latestBi: Promise<IFetchBi[]> | undefined;

jest.mock("@/app/components/k-panel", () => ({
  __esModule: true,
  default: ({ bi }: { bi: Promise<IFetchBi[]> }) => {
    latestBi = bi;
    return <div data-testid="k-panel" />;
  },
}));

it("defaults to Phase B and switches KPanel to Phase A", async () => {
  render(<ChanTestsPage cases={[caseWithMeta]} snapshots={{ [caseKey]: snapshot }} />);

  expect(screen.getByRole("button", { name: "Phase B 归约" })).toHaveAttribute(
    "aria-pressed", "true"
  );
  await expect(latestBi).resolves.toEqual([
    expect.objectContaining({ status: BiStatus.Valid, endTime: phaseBEnd }),
  ]);

  fireEvent.click(screen.getByRole("button", { name: "Phase A 原始" }));

  expect(screen.getByRole("button", { name: "Phase A 原始" })).toHaveAttribute(
    "aria-pressed", "true"
  );
  await expect(latestBi).resolves.toEqual([
    expect.objectContaining({ status: BiStatus.Invalid, endTime: phaseAEnd }),
  ]);
});
~~~

In the same test, expect labels 笔（Phase A） and 笔（Phase B） to show 47 and 25 when phase-specific metadata is supplied. Add a second test that selects Phase A, clicks a different case-list button, and verifies Phase A remains pressed.

- [x] **Step 2: Run the component test before controls exist**

Run: pnpm exec jest --runInBand --watchman=false app/chan-tests/__tests__/ChanTestsPage.test.tsx

Expected: FAIL because the page has no phase buttons and ChartData has no phase map.

- [x] **Step 3: Add phase state and accessible controls without changing KPanel**

Add:

~~~tsx
type BiPhase = "phaseA" | "phaseB";

const [selectedPhase, setSelectedPhase] = useState<BiPhase>("phaseB");
~~~

Render this group below the selected-case description:

~~~tsx
<div aria-label="笔归约阶段" role="group" style={{ display: "flex", gap: 8, marginTop: 12 }}>
  {([
    ["phaseA", "Phase A 原始"],
    ["phaseB", "Phase B 归约"],
  ] as const).map(([phase, label]) => (
    <button
      aria-pressed={selectedPhase === phase}
      key={phase}
      onClick={() => setSelectedPhase(phase)}
      style={{
        background: selectedPhase === phase ? "#2563eb" : "#f3f4f6",
        border: "none",
        borderRadius: 6,
        color: selectedPhase === phase ? "#fff" : "#374151",
        cursor: "pointer",
        padding: "6px 10px",
      }}
      type="button"
    >
      {label}
    </button>
  ))}
</div>
~~~

Pass selectedPhase to KPanelChartFromSnapshot. Preserve its KPanel call as one prop: bi={Promise.resolve(chart.bi[selectedPhase])}.

- [x] **Step 4: Render phase counts with the legacy fallback**

Replace the single Bi stat in StatsPanel.tsx with:

~~~tsx
const phaseABiCount = s.phaseABiCount ?? s.biCount;
const phaseBBiCount = s.phaseBBiCount ?? s.biCount;

<Stat label="笔（Phase A）" value={phaseABiCount} />
<Stat label="笔（Phase B）" value={phaseBBiCount} />
~~~

- [x] **Step 5: Run the component test**

Run: pnpm exec jest --runInBand --watchman=false app/chan-tests/__tests__/ChanTestsPage.test.tsx

Expected: PASS, proving Phase B is default, Phase A changes KPanel's Bi input, counts render, and the selection survives a case change.

- [x] **Step 6: Commit the console UI deliverable**

~~~bash
git add app/chan-tests/ChanTestsPage.tsx app/chan-tests/components/StatsPanel.tsx app/chan-tests/__tests__/ChanTestsPage.test.tsx
git commit -m "feat(chan-tests): add phase a and b preview selector"
~~~

### Task 3: Generate canonical fixtures from the current backend algorithm

**Files:**
- Create: mist/tools/export-chan-bi-phases.cjs
- Modify: mist-fe/scripts/generate-snapshots.mjs
- Modify: mist-fe/__fixtures__/snapshots/chan/*/bi.json
- Modify: mist-fe/__fixtures__/snapshots/chan/*/meta.json
- Create: mist-fe/app/chan-tests/lib/__tests__/shanghai-phase-fixture.test.ts

**Interfaces:**
- Consumes: one committed merge-k.json array or a live /v1/chan/bi response.
- Produces: canonical phase arrays, biCount equal to Phase B length, phaseABiCount, and phaseBBiCount.

- [x] **Step 1: Write a failing Shanghai fixture contract**

~~~ts
import { BiStatus } from "@/app/api/types";
import { readSnapshot } from "../load-snapshot";

it("keeps the leading invalid Phase A Bi and long valid Phase B Bi", () => {
  const snapshot = readSnapshot("shanghai-index-2024-2025");
  expect(snapshot?.bi.phaseA).toEqual(expect.arrayContaining([
    expect.objectContaining({
      startTime: "2024-10-07T16:00:00.000Z",
      endTime: "2024-10-15T16:00:00.000Z",
      trend: "down",
      status: BiStatus.Invalid,
    }),
  ]));
  expect(snapshot?.bi.phaseB).toEqual(expect.arrayContaining([
    expect.objectContaining({
      startTime: "2024-10-07T16:00:00.000Z",
      endTime: "2025-01-12T16:00:00.000Z",
      trend: "down",
      status: BiStatus.Valid,
    }),
  ]));
});
~~~

- [x] **Step 2: Run the contract before fixture regeneration**

Run: pnpm exec jest --runInBand --watchman=false app/chan-tests/lib/__tests__/shanghai-phase-fixture.test.ts

Expected: FAIL because legacy Phase A and Phase B are identical and omit the retained invalid candidate.

- [x] **Step 3: Add the backend JSON-only phase exporter**

Create mist/tools/export-chan-bi-phases.cjs:

~~~js
#!/usr/bin/env node
require("ts-node/register");

const fs = require("node:fs");
const path = require("node:path");
const { BiService } = require("../apps/mist/src/chan/services/bi.service");

const [inputPath] = process.argv.slice(2);
if (!inputPath) {
  throw new Error("Usage: node tools/export-chan-bi-phases.cjs <merge-k.json>");
}

const raw = JSON.parse(fs.readFileSync(path.resolve(inputPath), "utf8"));
if (!Array.isArray(raw)) throw new Error("merge-k.json 必须是数组");

const data = raw.map((m) => ({
  ...m,
  startTime: new Date(m.startTime),
  endTime: new Date(m.endTime),
  mergedData: m.mergedData.map((k) => ({
    ...k,
    time: new Date(k.time),
    amount: Number(k.amount),
    open: Number(k.open),
    close: Number(k.close),
    highest: Number(k.highest),
    lowest: Number(k.lowest),
  })),
}));

process.stdout.write(JSON.stringify(new BiService().getBi(data), null, 2) + "\n");
~~~

The script emits only JSON to stdout so the frontend generator can parse it.

- [x] **Step 4: Add explicit --bi-from-merge-k generator mode**

In scripts/generate-snapshots.mjs:
1. import execFileSync from node:child_process;
2. parse const biFromMergeK = args.includes("--bi-from-merge-k");
3. add normalizeBiPayload(value), which accepts a legacy array or validates phaseA and phaseB arrays;
4. in biFromMergeK mode, read the existing merge-k.json and run:

~~~js
const BACKEND_ROOT = path.resolve(REPO_ROOT, "..", "mist");
const output = execFileSync(process.execPath, [
  path.join(BACKEND_ROOT, "tools", "export-chan-bi-phases.cjs"),
  path.join(outDir, "merge-k.json"),
], { cwd: BACKEND_ROOT, encoding: "utf8" });
const bi = normalizeBiPayload(JSON.parse(output));
~~~

5. in normal mode, use normalizeBiPayload(await callBackend("/v1/chan/bi", query));
6. always write the canonical object and use:

~~~js
biCount: bi.phaseB.length,
phaseABiCount: bi.phaseA.length,
phaseBBiCount: bi.phaseB.length,
~~~

The bi-from-merge-k mode must not call backend endpoints or write k.json, merge-k.json, fenxing.json, or channel.json.

- [x] **Step 5: Regenerate all four Bi fixtures deterministically**

Run from mist-fe:

~~~bash
pnpm run snapshots:generate -- --bi-from-merge-k
~~~

Expected: four bi.json files become canonical objects; only four meta.json files change among metadata; Shanghai reports Phase A 47 and Phase B 25.

- [x] **Step 6: Run fixture contract and inspect the snapshot diff**

Run: pnpm exec jest --runInBand --watchman=false app/chan-tests/lib/__tests__/shanghai-phase-fixture.test.ts

Expected: PASS with the 2024-10-07 to 2024-10-15 Invalid Phase A Bi and the 2024-10-07 to 2025-01-12 Valid Phase B Bi.

Run: git diff --stat -- __fixtures__/snapshots/chan

Expected: only four bi.json and four meta.json files are listed.

- [x] **Step 7: Commit exporter, generator, and fixtures**

~~~bash
cd ../mist
git add tools/export-chan-bi-phases.cjs
git commit -m "tools(chan): export phase-aware bi snapshots"
cd ../mist-fe
git add scripts/generate-snapshots.mjs __fixtures__/snapshots/chan app/chan-tests/lib/__tests__/shanghai-phase-fixture.test.ts
git commit -m "test(chan-tests): regenerate phase-aware bi fixtures"
~~~

### Task 4: Verify the OpenSpec acceptance criteria and browser presentation

**Files:**
- Modify: mist/openspec/changes/preview-chan-bi-phases/tasks.md
- Modify: mist-fe/docs/superpowers/plans/2026-07-11-chan-tests-phase-b-preview.md

**Interfaces:**
- Consumes: completed implementation and local Next development server at http://localhost:3000/chan-tests.
- Produces: evidence that canonical fixtures, selector, and Phase B default work end to end.

- [x] **Step 1: Run all focused Chan test-console tests**

~~~bash
pnpm exec jest --runInBand --watchman=false app/chan-tests/lib/__tests__/load-snapshot.test.ts app/chan-tests/lib/__tests__/snapshot-to-chart.test.ts app/chan-tests/__tests__/ChanTestsPage.test.tsx app/chan-tests/lib/__tests__/shanghai-phase-fixture.test.ts
~~~

Expected: PASS.

- [x] **Step 2: Run static and production checks**

~~~bash
pnpm run typecheck
pnpm run lint
pnpm run build
~~~

Expected: each command exits 0.

- [x] **Step 3: Verify the page in the local browser**

At http://localhost:3000/chan-tests inspect the Shanghai case:
- Phase B 归约 has aria-pressed=true on initial load.
- 笔（Phase A） displays 47 and 笔（Phase B） displays 25.
- Clicking Phase A 原始 makes it the pressed control.
- No browser console errors appear after either switch.

- [x] **Step 4: Mark verified OpenSpec tasks complete and validate**

Replace each completed checkbox in mist/openspec/changes/preview-chan-bi-phases/tasks.md with - [x], then run:

~~~bash
cd ../mist
openspec validate preview-chan-bi-phases --strict
~~~

Expected: Change preview-chan-bi-phases is valid.

- [ ] **Step 5: Commit OpenSpec evidence and execution plan**

~~~bash
cd ../mist
git add openspec/changes/preview-chan-bi-phases
git commit -m "docs(openspec): specify chan bi phase preview"
cd ../mist-fe
git add docs/superpowers/plans/2026-07-11-chan-tests-phase-b-preview.md
git commit -m "docs: record chan tests phase preview plan"
~~~
