import { fireEvent, render, screen } from "@testing-library/react";
import {
  BiStatus,
  ChannelStatus,
  type IFetchBi,
  type IFetchChannel,
} from "@/app/api/types";
import { ChanTestsPage } from "../ChanTestsPage";
import type {
  CaseWithMeta,
  SnapshotData,
  SnapshotStats,
} from "../lib/load-snapshot";

let mockLatestBi: Promise<IFetchBi[]> | undefined;
let mockLatestChannel: Promise<IFetchChannel[]> | undefined;

jest.mock("@/app/components/k-panel", () => ({
  __esModule: true,
  default: ({
    bi,
    channel,
  }: {
    bi: Promise<IFetchBi[]>;
    channel: Promise<IFetchChannel[]>;
  }) => {
    mockLatestBi = bi;
    mockLatestChannel = channel;
    return <div data-testid="k-panel" />;
  },
}));

const caseKey = "case-one";
const secondCaseKey = "case-two";
const phaseAEnd = "2025-01-11T16:00:00.000Z";
const phaseBEnd = "2025-01-12T16:00:00.000Z";

function createBi(status: BiStatus, endTime: string) {
  return {
    startTime: "2025-01-10T16:00:00.000Z",
    endTime,
    highest: 10,
    lowest: 1,
    trend: "up",
    type: "complete",
    status,
    independentCount: 2,
    originIds: [],
    originData: [],
    startFenxing: null,
    endFenxing: null,
  };
}

function createCase(
  key: string,
  name: string,
  stats: SnapshotStats
): CaseWithMeta {
  return {
    testCase: {
      key,
      name,
      code: "000001",
      source: "tdx",
      period: 1440,
      startDate: "2025-01-01",
      endDate: "2025-01-12",
    },
    meta: {
      key,
      name,
      generatedAt: "2025-01-13T16:00:00.000Z",
      testCase: {
        code: "000001",
        source: "tdx",
        period: 1440,
        startDate: "2025-01-01",
        endDate: "2025-01-12",
      },
      stats,
    },
  };
}

function createSnapshot(testCase: CaseWithMeta): SnapshotData {
  if (!testCase.meta) throw new Error("test fixture requires metadata");

  return {
    meta: testCase.meta,
    k: [],
    mergeK: [],
    bi: {
      phaseA: [createBi(BiStatus.Invalid, phaseAEnd)],
      phaseB: [createBi(BiStatus.Valid, phaseBEnd)],
    },
    fenxing: [],
    channel: {
      phaseA: [
        {
          startId: 1,
          endId: 5,
          displayStartId: 1,
          displayEndId: 5,
          bis: [],
          zg: 10,
          zd: 8,
          gg: 12,
          dd: 6,
          level: "bi",
          type: "complete",
          trend: "up",
          status: ChannelStatus.Invalid,
        },
      ],
      phaseB: [
        {
          startId: 2,
          endId: 6,
          displayStartId: 2,
          displayEndId: 6,
          bis: [],
          zg: 11,
          zd: 9,
          gg: 13,
          dd: 7,
          level: "bi",
          type: "complete",
          trend: "up",
          status: ChannelStatus.Valid,
        },
      ],
    },
  };
}

const phaseStats = {
  kCount: 100,
  mergeKCount: 80,
  biCount: 60,
  phaseABiCount: 47,
  phaseBBiCount: 25,
  channelCount: 4,
  fenxingCount: 20,
};
const caseWithMeta = createCase(caseKey, "Case One", phaseStats);
const secondCaseWithMeta = createCase(secondCaseKey, "Case Two", phaseStats);
const snapshot = createSnapshot(caseWithMeta);
const secondSnapshot = createSnapshot(secondCaseWithMeta);

function expectStat(label: string, value: number) {
  expect(screen.getByText(label).parentElement).toHaveTextContent(String(value));
}

describe("ChanTestsPage", () => {
  beforeEach(() => {
    mockLatestBi = undefined;
    mockLatestChannel = undefined;
  });

  it("defaults to Phase B and switches KPanel to Phase A", async () => {
    render(
      <ChanTestsPage
        cases={[caseWithMeta]}
        snapshots={{ [caseKey]: snapshot }}
      />
    );

    expect(screen.getByRole("button", { name: "Phase B 归约" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expectStat("笔（Phase A）", 47);
    expectStat("笔（Phase B）", 25);

    const initialBi = mockLatestBi;
    expect(initialBi).toBeDefined();
    await expect(initialBi!).resolves.toEqual([
      expect.objectContaining({ status: BiStatus.Valid, endTime: phaseBEnd }),
    ]);
    await expect(mockLatestChannel!).resolves.toEqual([
      expect.objectContaining({ status: ChannelStatus.Valid, startId: 2 }),
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Phase A 原始" }));

    expect(screen.getByRole("button", { name: "Phase A 原始" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    const selectedBi = mockLatestBi;
    expect(selectedBi).toBeDefined();
    await expect(selectedBi!).resolves.toEqual([
      expect.objectContaining({ status: BiStatus.Invalid, endTime: phaseAEnd }),
    ]);
    await expect(mockLatestChannel!).resolves.toEqual([
      expect.objectContaining({ status: ChannelStatus.Invalid, startId: 1 }),
    ]);
  });

  it("keeps the selected phase when changing cases", () => {
    render(
      <ChanTestsPage
        cases={[caseWithMeta, secondCaseWithMeta]}
        snapshots={{
          [caseKey]: snapshot,
          [secondCaseKey]: secondSnapshot,
        }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Phase A 原始" }));
    fireEvent.click(screen.getByRole("button", { name: /Case Two/ }));

    expect(screen.getByRole("button", { name: "Phase A 原始" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  it("uses the legacy Bi count when phase-specific counts are unavailable", () => {
    const legacyCase = createCase("legacy-case", "Legacy Case", {
      ...phaseStats,
      biCount: 31,
      phaseABiCount: undefined,
      phaseBBiCount: undefined,
    });

    render(
      <ChanTestsPage
        cases={[legacyCase]}
        snapshots={{ "legacy-case": createSnapshot(legacyCase) }}
      />
    );

    expectStat("笔（Phase A）", 31);
    expectStat("笔（Phase B）", 31);
  });
});
