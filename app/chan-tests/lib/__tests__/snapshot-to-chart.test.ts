import { BiStatus, ChannelStatus } from "@/app/api/types";
import type { SnapshotData } from "../load-snapshot";
import { snapshotToChart } from "../snapshot-to-chart";

const baseBi = {
  startTime: "2025-01-10T16:00:00.000Z",
  endTime: "2025-01-11T16:00:00.000Z",
  highest: 10,
  lowest: 1,
  trend: "up",
  type: "complete",
  status: 0,
  independentCount: 2,
  originIds: [],
  originData: [],
  startFenxing: null,
  endFenxing: null,
};

const baseSnapshot: SnapshotData = {
  meta: {
    key: "test-case",
    name: "Test case",
    generatedAt: "2025-01-12T16:00:00.000Z",
    testCase: {
      code: "000001",
      source: "test",
      period: 1,
      startDate: "2025-01-01",
      endDate: "2025-01-12",
    },
    stats: {
      kCount: 0,
      mergeKCount: 0,
      biCount: 0,
      channelCount: 0,
      fenxingCount: 0,
    },
  },
  k: [],
  mergeK: [],
  bi: {
    phaseA: [],
    phaseB: [],
  },
  fenxing: [],
  channel: { phaseA: [], phaseB: [] },
};

describe("snapshotToChart", () => {
  it("normalizes each Bi phase independently", () => {
    const chart = snapshotToChart({
      ...baseSnapshot,
      bi: {
        phaseA: [{ ...baseBi, status: 2 }],
        phaseB: [
          {
            ...baseBi,
            status: 1,
            endTime: "2025-01-12T16:00:00.000Z",
          },
        ],
      },
    });

    expect(chart.bi.phaseA[0].status).toBe(BiStatus.Invalid);
    expect(chart.bi.phaseB[0]).toMatchObject({
      status: BiStatus.Valid,
      endTime: "2025-01-12T16:00:00.000Z",
    });
  });

  it("normalizes each channel phase status independently", () => {
    const baseChannel = {
      bis: [],
      zg: 10,
      zd: 5,
      gg: 12,
      dd: 3,
      level: "bi",
      type: "complete",
      startId: 1,
      endId: 5,
      trend: "up",
      displayStartId: 1,
      displayEndId: 5,
    };

    const chart = snapshotToChart({
      ...baseSnapshot,
      channel: {
        phaseA: [{ ...baseChannel, status: "2" }],
        phaseB: [{ ...baseChannel, status: "1" }],
      },
    });

    expect(chart.channel.phaseA[0].status).toBe(ChannelStatus.Invalid);
    expect(chart.channel.phaseB[0].status).toBe(ChannelStatus.Valid);
  });
});
