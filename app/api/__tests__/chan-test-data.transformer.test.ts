import { transformChanTestData } from "../transformers/chan-test-data.transformer";

const baseResults = {
  metadata: {
    testName: "fixture",
    timestamp: "2026-01-01T00:00:00Z",
    dataSource: "tdx",
    dataRange: {
      start: "2026-01-01",
      end: "2026-01-02",
      totalDays: 2,
      breakdown: { 2024: 0, 2025: 0 },
    },
    marketStats: {
      highest: 10,
      lowest: 1,
      yearStart2024: 1,
      yearEnd2024: 2,
      yearReturn2024: 1,
    },
  },
  summary: {
    originalKLines: 2,
    mergedKLines: 1,
    mergeRatio: 0.5,
    totalBis: 1,
    completeBis: 1,
    uncompleteBis: 0,
    upBis: 1,
    downBis: 0,
    totalChannels: 1,
    completeChannels: 1,
    uncompleteChannels: 0,
  },
  biStatistics: {
    averageDuration: 1,
    maxDuration: 1,
    minDuration: 1,
  },
  data: {
    originalKLines: [
      {
        id: 1,
        symbol: "000001",
        time: "2026-01-01T00:00:00Z",
        amount: 1,
        open: 1,
        close: 2,
        highest: 3,
        lowest: 1,
      },
    ],
    mergedKLines: [
      {
        startTime: "2026-01-01T00:00:00Z",
        endTime: "2026-01-01T00:00:00Z",
        highest: 3,
        lowest: 1,
        trend: "up",
        mergedCount: 1,
        mergedIds: [1],
        mergedData: [],
      },
    ],
    bis: [
      {
        startTime: "2026-01-01T00:00:00Z",
        endTime: "2026-01-01T00:00:00Z",
        highest: 3,
        lowest: 1,
        trend: "up",
        type: "complete",
        originIds: [1],
        originData: [],
        independentCount: 1,
        startFenxing: null,
        endFenxing: null,
      },
    ],
    channels: [
      {
        zg: 3,
        zd: 1,
        gg: 3,
        dd: 1,
        bis: [],
        level: "bi",
        type: "complete",
        startId: 1,
        endId: 1,
        trend: "up",
      },
    ],
  },
};

function cloneBaseResults(): typeof baseResults {
  return JSON.parse(JSON.stringify(baseResults)) as typeof baseResults;
}

describe("transformChanTestData enum guards", () => {
  it.each([
    [
      "merge-k trend",
      (results: typeof baseResults) => {
        results.data.mergedKLines[0].trend = "sideways";
      },
    ],
    [
      "bi trend",
      (results: typeof baseResults) => {
        results.data.bis[0].trend = "sideways";
      },
    ],
    [
      "bi type",
      (results: typeof baseResults) => {
        results.data.bis[0].type = "done";
      },
    ],
    [
      "channel level",
      (results: typeof baseResults) => {
        results.data.channels[0].level = "segment";
      },
    ],
    [
      "channel type",
      (results: typeof baseResults) => {
        results.data.channels[0].type = "done";
      },
    ],
    [
      "channel trend",
      (results: typeof baseResults) => {
        results.data.channels[0].trend = "sideways";
      },
    ],
  ])("rejects invalid %s", (_label, mutate) => {
    const invalidResults = cloneBaseResults();
    mutate(invalidResults);

    expect(() => transformChanTestData(invalidResults as never)).toThrow(
      /Invalid/
    );
  });
});
