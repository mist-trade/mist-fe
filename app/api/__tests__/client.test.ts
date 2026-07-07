import {
  acknowledgeStrategyAlertEvent,
  collectKLines,
  createStrategyBacktest,
  createStrategyDefinition,
  disableStrategyDefinition,
  enableStrategyDefinition,
  fetchBi,
  fetchChannel,
  fetchFenxing,
  fetchK,
  fetchMergeK,
  fetchSecurities,
  fetchStrategyAlertEvents,
  fetchStrategyBacktestRun,
  fetchStrategyBacktestSignals,
  fetchStrategySignals,
  getAnalysisApiBase,
  getMistApiBase,
  listStrategies,
  listStrategyVersions,
  runStrategyScan,
  updateStrategyDefinition,
  unwrapApiResponse,
} from "../client";

const originalEnv = process.env;

describe("Mist frontend API client", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    process.env = { ...originalEnv };
    delete process.env.NEXT_PUBLIC_MIST_API_BASE_URL;
    delete process.env.NEXT_PUBLIC_CHAN_API_BASE_URL;
    delete process.env.NEXT_PUBLIC_MIST_API_BASE_PATH;
    delete process.env.NEXT_PUBLIC_CHAN_API_BASE_PATH;
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    global.fetch = jest.fn();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("defaults production requests to same-origin gateway paths", () => {
    expect(getMistApiBase()).toBe("/api/mist");
    expect(getAnalysisApiBase()).toBe("/api/chan");
  });

  it("uses local direct URL overrides when configured", () => {
    process.env.NEXT_PUBLIC_MIST_API_BASE_URL = "http://127.0.0.1:8001/";
    process.env.NEXT_PUBLIC_CHAN_API_BASE_URL = "http://127.0.0.1:8008/";

    expect(getMistApiBase()).toBe("http://127.0.0.1:8001");
    expect(getAnalysisApiBase()).toBe("http://127.0.0.1:8008");
  });

  it("unwraps unified backend envelopes and accepts bare payloads", () => {
    expect(unwrapApiResponse({ success: true, data: [{ code: "600519" }] })).toEqual([
      { code: "600519" },
    ]);
    expect(unwrapApiResponse([{ code: "000001" }])).toEqual([{ code: "000001" }]);
  });

  it("throws backend envelope error messages", () => {
    expect(() =>
      unwrapApiResponse({
        success: false,
        message: "No enabled data source configured for security: 600519",
      })
    ).toThrow("No enabled data source configured for security: 600519");
  });

  it("loads securities from the Mist backend path", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: [{ code: "600519", name: "贵州茅台", type: "stock", status: 1 }],
      }),
    });

    await expect(fetchSecurities()).resolves.toEqual([
      { code: "600519", name: "贵州茅台", type: "stock", status: 1 },
    ]);
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/mist/v1/securities",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("collects K-lines through the Mist backend with the selected query", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { code: "600519", period: 1440, count: 2 } }),
    });

    await collectKLines({
      code: "600519",
      source: "tdx",
      period: 1440,
      startDate: "2026-01-01",
      endDate: "2026-06-30",
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/mist/v1/collector/collect",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          code: "600519",
          source: "tdx",
          period: 1440,
          startDate: "2026-01-01",
          endDate: "2026-06-30",
        }),
      })
    );
  });

  it("fetches K-lines from the analysis API without adding legacy symbol fields", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => [
        {
          id: 1,
          symbol: "600519",
          time: "2026-06-30T00:00:00.000Z",
          amount: 1000,
          open: 1,
          close: 2,
          highest: 3,
          lowest: 0.5,
        },
      ],
    });

    await fetchK({
      code: "600519",
      source: "tdx",
      period: 1440,
      startDate: "2026-01-01",
      endDate: "2026-06-30",
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/chan/v1/indicators/k",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          code: "600519",
          source: "tdx",
          period: 1440,
          startDate: "2026-01-01",
          endDate: "2026-06-30",
        }),
      })
    );
  });

  it("fetches Chan overlays with the selected query shape", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => [],
    });

    const query = {
      code: "600519",
      source: "tdx" as const,
      period: 1440,
      startDate: "2026-01-01",
      endDate: "2026-06-30",
    };

    await fetchMergeK(query);
    await fetchBi(query);
    await fetchFenxing(query);
    await fetchChannel(query);

    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      "/api/chan/v1/chan/merge-k",
      expect.objectContaining({ method: "POST", body: JSON.stringify(query) })
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      "/api/chan/v1/chan/bi",
      expect.objectContaining({ method: "POST", body: JSON.stringify(query) })
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      3,
      "/api/chan/v1/chan/fenxing",
      expect.objectContaining({ method: "POST", body: JSON.stringify(query) })
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      4,
      "/api/chan/v1/chan/channel",
      expect.objectContaining({ method: "POST", body: JSON.stringify(query) })
    );
  });

  it("calls strategy registry endpoints through the Mist v1 gateway path", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: [] }),
    });

    const strategyPayload = {
      name: "突破策略",
      description: "close gt 100",
      targetUniverse: ["600519"],
      periods: [1440],
      sources: ["tdx" as const],
      rule: { field: "k.close", operator: "gt", value: 100 },
    };

    await listStrategies();
    await createStrategyDefinition(strategyPayload);
    await updateStrategyDefinition(3, { name: "突破策略 v2", rule: strategyPayload.rule });
    await enableStrategyDefinition(3);
    await disableStrategyDefinition(3);
    await listStrategyVersions(3);

    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      "/api/mist/v1/strategies",
      expect.objectContaining({ method: "GET" })
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      "/api/mist/v1/strategies",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(strategyPayload),
      })
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      3,
      "/api/mist/v1/strategies/3",
      expect.objectContaining({ method: "PATCH" })
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      4,
      "/api/mist/v1/strategies/3/enable",
      expect.objectContaining({ method: "POST" })
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      5,
      "/api/mist/v1/strategies/3/disable",
      expect.objectContaining({ method: "POST" })
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      6,
      "/api/mist/v1/strategies/3/versions",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("calls signal, alert, scan, and backtest endpoints through Mist v1 paths", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: [] }),
    });

    await fetchStrategySignals({
      strategyDefinitionId: 3,
      securityCode: "600519",
      period: 1440,
      source: "tdx",
    });
    await fetchStrategyAlertEvents({ status: "pending", strategySignalId: 8 });
    await acknowledgeStrategyAlertEvent(9);
    await runStrategyScan({ strategyDefinitionId: 3, period: 1440, source: "tdx" });
    await createStrategyBacktest({
      strategyVersionId: 5,
      targetUniverse: ["600519"],
      period: 1440,
      source: "tdx",
      startDate: "2026-01-01",
      endDate: "2026-06-30",
    });
    await fetchStrategyBacktestRun(11);
    await fetchStrategyBacktestSignals(11);

    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      "/api/mist/v1/strategy-signals?strategyDefinitionId=3&securityCode=600519&period=1440&source=tdx",
      expect.objectContaining({ method: "GET" })
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      "/api/mist/v1/strategy-alert-events?status=pending&strategySignalId=8",
      expect.objectContaining({ method: "GET" })
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      3,
      "/api/mist/v1/strategy-alert-events/9/ack",
      expect.objectContaining({ method: "POST" })
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      4,
      "/api/mist/v1/strategy-scans/run",
      expect.objectContaining({ method: "POST" })
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      5,
      "/api/mist/v1/strategy-backtests",
      expect.objectContaining({ method: "POST" })
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      6,
      "/api/mist/v1/strategy-backtests/11",
      expect.objectContaining({ method: "GET" })
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      7,
      "/api/mist/v1/strategy-backtests/11/signals",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("keeps strategy API calls off the analysis and datasource base paths", async () => {
    process.env.NEXT_PUBLIC_MIST_API_BASE_PATH = "/api/mist";
    process.env.NEXT_PUBLIC_CHAN_API_BASE_PATH = "/api/chan";
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: [] }),
    });

    await listStrategies();
    await fetchStrategyAlertEvents();
    await createStrategyBacktest({
      strategyVersionId: 5,
      targetUniverse: ["600519"],
      period: 1440,
      source: "tdx",
      startDate: "2026-01-01",
      endDate: "2026-06-30",
    });

    for (const [url] of (global.fetch as jest.Mock).mock.calls) {
      expect(url).toMatch(/^\/api\/mist\/v1\/(strategies|strategy-)/);
      expect(url).not.toContain("/api/chan");
      expect(url).not.toContain("datasource");
      expect(url).not.toContain("provider");
    }
  });
});
