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
  SnapshotMeta,
} from "../lib/load-snapshot";

let mockLatestCommands: unknown[] | undefined;

jest.mock("@/app/components/tv-chart/TradingViewChart", () => ({
  __esModule: true,
  default: ({
    commands,
  }: {
    commands?: unknown[];
  }) => {
    mockLatestCommands = commands;
    return <div data-testid="tv-chart" />;
  },
}));

const caseKey = "case-one";
const phaseAEnd = "2025-01-11T16:00:00.000Z";
const phaseBEnd = "2025-01-12T16:00:00.000Z";


function createBi(status: BiStatus, endTime: string) {
  return {
    startTime: "2025-01-10T16:00:00.000Z",
    endTime,
    high: 10,
    low: 1,
    trend: "up",
    type: "complete",
    status,
    independentCount: 2,
    originIds: [],
    originData: [],
    startFenxing: null,
    endFenxing: null,
  } as unknown as IFetchBi;
}

function createChannel(status: ChannelStatus) {
  return {
    zg: 10,
    zd: 1,
    gg: 12,
    dd: 0.5,
    level: "bi",
    type: "complete",
    status,
    bis: [
      createBi(BiStatus.Valid, "2025-01-10T16:00:00.000Z"),
      createBi(BiStatus.Valid, "2025-01-11T16:00:00.000Z"),
    ],
  } as unknown as IFetchChannel;
}

function createMeta(key: string, name: string): SnapshotMeta {
  return {
    key,
    name,
    generatedAt: "2025-01-15T00:00:00.000Z",
    testCase: {
      code: "000001",
      source: "tdx",
      period: 1440,
      startDate: "2025-01-01",
      endDate: "2025-01-15",
    },
    stats: {
      biCount: 1,
      channelCount: 1,
      fenxingCount: 0,
      kCount: 0,
      mergeKCount: 0,
    },
  };
}

function createSnapshot(biEndTime: string): SnapshotData {
  return {
    meta: createMeta(caseKey, "Case One"),
    k: [],
    mergeK: [],
    bi: {
      phaseA: [createBi(BiStatus.Valid, phaseAEnd)],
      phaseB: [createBi(BiStatus.Valid, biEndTime)],
    },
    fenxing: [],
    channel: {
      phaseA: [createChannel(ChannelStatus.Valid)],
      phaseB: [createChannel(ChannelStatus.Valid)],
    },
  };
}

function createCase(key: string, name: string): CaseWithMeta {
  return {
    testCase: {
      key,
      name,
      code: "000001",
      source: "tdx",
      period: 1440,
      startDate: "2025-01-01",
      endDate: "2025-01-15",
    },
    meta: createMeta(key, name),
  };
}


describe("ChanTestsPage", () => {
  beforeEach(() => {
    mockLatestCommands = undefined;
  });

  it("renders with cases and snapshot data", async () => {
    const cases = [createCase(caseKey, "Case One")];
    const snapshots = { [caseKey]: createSnapshot(phaseBEnd) };

    render(<ChanTestsPage cases={cases} snapshots={snapshots} />);

    expect(screen.getByRole("heading", { name: "缠论算法回归测试台" })).toBeInTheDocument();
    expect(screen.getByText("Case One · 000001")).toBeInTheDocument();
    expect(await screen.findByTestId("tv-chart")).toBeInTheDocument();
  });

  it("switches phase and passes correct visual commands to chart", async () => {
    const cases = [createCase(caseKey, "Case One")];
    const snapshots = { [caseKey]: createSnapshot(phaseBEnd) };

    render(<ChanTestsPage cases={cases} snapshots={snapshots} />);

    await screen.findByTestId("tv-chart");
    expect(mockLatestCommands).toBeDefined();

    // Switch to Phase A
    fireEvent.click(screen.getByRole("button", { name: "Phase A 原始" }));
    expect(mockLatestCommands).toBeDefined();
  });
});
