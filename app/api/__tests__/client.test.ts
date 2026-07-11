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
  fetchStrategyBacktestOrders,
  fetchStrategyBacktestPositions,
  fetchStrategyBacktestSignals,
  fetchStrategyBacktestTrades,
  fetchStrategySignals,
  getAnalysisApiBase,
  getMistApiBase,
  listStrategies,
  listStrategyBacktests,
  listStrategyVersions,
  runStrategyScan,
  updateStrategyDefinition,
  unwrapApiResponse,
} from "../client";
import * as strategyClient from "../client";

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

  it("normalizes a legacy bi array into both phases", async () => {
    const legacy = [{ startTime: "2026-01-01", endTime: "2026-01-02" }];
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => legacy,
    });

    await expect(
      fetchBi({
        code: "600519",
        source: "tdx",
        period: 1440,
        startDate: "2026-01-01",
        endDate: "2026-06-30",
      })
    ).resolves.toEqual({ phaseA: legacy, phaseB: legacy });
  });

  it("preserves canonical bi phases and rejects partial objects", async () => {
    const query = {
      code: "600519",
      source: "tdx" as const,
      period: 1440,
      startDate: "2026-01-01",
      endDate: "2026-06-30",
    };
    const canonical = {
      phaseA: [{ startTime: "2026-01-01" }],
      phaseB: [{ startTime: "2026-01-02" }],
    };
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => canonical })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ phaseA: [] }),
      });

    await expect(fetchBi(query)).resolves.toEqual(canonical);
    await expect(fetchBi(query)).rejects.toThrow(
      "bi response must be an array or contain phaseA and phaseB arrays"
    );
  });

  it("normalizes a legacy channel array into both phases", async () => {
    const legacy = [{ startId: 1, endId: 5 }];
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => legacy,
    });

    await expect(
      fetchChannel({
        code: "600519",
        source: "tdx",
        period: 1440,
        startDate: "2026-01-01",
        endDate: "2026-06-30",
      })
    ).resolves.toEqual({ phaseA: legacy, phaseB: legacy });
  });

  it("preserves canonical channel phases and rejects partial objects", async () => {
    const query = {
      code: "600519",
      source: "tdx" as const,
      period: 1440,
      startDate: "2026-01-01",
      endDate: "2026-06-30",
    };
    const canonical = {
      phaseA: [{ startId: 1 }],
      phaseB: [{ startId: 2 }],
    };
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => canonical })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ phaseA: [] }),
      });

    await expect(fetchChannel(query)).resolves.toEqual(canonical);
    await expect(fetchChannel(query)).rejects.toThrow(
      "channel response must be an array or contain phaseA and phaseB arrays"
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
      entryRule: { field: "k.close", operator: "gt", value: 100 },
      exitRule: { field: "k.close", operator: "lt", value: 90 },
      lookbackBars: 1,
      backtestEnabled: false,
    };

    await listStrategies();
    await createStrategyDefinition(strategyPayload);
    await updateStrategyDefinition(3, {
      name: "突破策略 v2",
      entryRule: strategyPayload.entryRule,
    });
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
      strategyDefinitionId: 3,
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
      strategyDefinitionId: 3,
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

  it("preserves cursor pagination for portfolio run and fact queries", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { items: [], nextCursor: null } }),
    });

    await listStrategyBacktests({
      strategyDefinitionId: 3,
      cursor: "run-cursor",
      limit: 25,
    });
    await fetchStrategyBacktestSignals(11, { cursor: "signal-cursor", limit: 5 });
    await fetchStrategyBacktestOrders(11, { cursor: "order-cursor", limit: 10 });
    await fetchStrategyBacktestTrades(11, { cursor: "trade-cursor", limit: 15 });
    await fetchStrategyBacktestPositions(11, {
      asOf: "2026-06-30",
      cursor: "position-cursor",
      limit: 20,
    });

    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      "/api/mist/v1/strategy-backtests?strategyDefinitionId=3&cursor=run-cursor&limit=25",
      expect.objectContaining({ method: "GET" })
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      "/api/mist/v1/strategy-backtests/11/signals?cursor=signal-cursor&limit=5",
      expect.objectContaining({ method: "GET" })
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      3,
      "/api/mist/v1/strategy-backtests/11/orders?cursor=order-cursor&limit=10",
      expect.objectContaining({ method: "GET" })
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      4,
      "/api/mist/v1/strategy-backtests/11/trades?cursor=trade-cursor&limit=15",
      expect.objectContaining({ method: "GET" })
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      5,
      "/api/mist/v1/strategy-backtests/11/positions?asOf=2026-06-30&cursor=position-cursor&limit=20",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("exposes the asynchronous portfolio result API family", () => {
    expect(strategyClient).toEqual(
      expect.objectContaining({
        cancelStrategyBacktest: expect.any(Function),
        fetchStrategyBacktestEquity: expect.any(Function),
        fetchStrategyBacktestOrders: expect.any(Function),
        fetchStrategyBacktestTrades: expect.any(Function),
        fetchStrategyBacktestPositions: expect.any(Function),
        listStrategyBacktests: expect.any(Function),
      })
    );
  });
});
