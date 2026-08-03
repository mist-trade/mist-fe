import {
  MistApiContractError,
  MistApiError,
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
  parseEnvelope,
  requestNoContent,
  runStrategyScan,
  updateStrategyDefinition,
} from "../client";

const originalEnv = process.env;

type MockHeaders = Record<string, string | null>;

const buildHeaders = (headers?: MockHeaders): Headers => {
  const entries: Array<[string, string]> = [];
  if (headers) {
    for (const [key, value] of Object.entries(headers)) {
      if (value !== null) entries.push([key, value]);
    }
  }
  return new Headers(entries);
};

const mockResponse = (
  body: unknown,
  init: { status: number; headers?: MockHeaders } = { status: 200 }
) => ({
  ok: init.status >= 200 && init.status < 300,
  status: init.status,
  headers: buildHeaders(init.headers),
  json: async () => body,
  text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
});

const successEnvelope = (
  data: unknown,
  init: { status?: number; requestId?: string; headers?: MockHeaders } = {}
) =>
  mockResponse(
    {
      success: true,
      statusCode: init.status ?? 200,
      message: "SUCCESS",
      data,
      timestamp: "2026-08-03T00:00:00.000Z",
      requestId: init.requestId ?? "http-success-1",
      path: "/v1/securities",
    },
    {
      status: init.status ?? 200,
      headers: { "x-request-id": init.requestId ?? "http-success-1", ...(init.headers ?? {}) },
    }
  );

const errorEnvelope = (
  init: {
    status: number;
    code: string;
    message: string;
    requestId?: string;
    data?: unknown;
    errors?: Record<string, string[]>;
    bodyStatusCodeOverride?: number;
  }
) =>
  mockResponse(
    {
      success: false,
      statusCode: init.bodyStatusCodeOverride ?? init.status,
      code: init.code,
      message: init.message,
      data: init.data,
      errors: init.errors,
      timestamp: "2026-08-03T00:00:00.000Z",
      requestId: init.requestId ?? `http-${init.code.toLowerCase()}`,
      path: "/v1/securities",
    },
    {
      status: init.status,
      headers: { "x-request-id": init.requestId ?? `http-${init.code.toLowerCase()}` },
    }
  );

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

  describe("parseEnvelope contract", () => {
    it("returns typed data from a valid HTTP 200 success envelope", () => {
      expect(
        parseEnvelope(
          {
            success: true,
            statusCode: 200,
            message: "SUCCESS",
            data: [{ code: "600519" }],
            timestamp: "2026-08-03T00:00:00.000Z",
            requestId: "http-1",
            path: "/v1/securities",
          },
          200,
          undefined
        )
      ).toEqual([{ code: "600519" }]);
    });

    it("returns data from a valid HTTP 201 success envelope", () => {
      expect(
        parseEnvelope(
          {
            success: true,
            statusCode: 201,
            message: "CREATED",
            data: { id: 7 },
            timestamp: "2026-08-03T00:00:00.000Z",
            requestId: "http-2",
            path: "/v1/strategies",
          },
          201,
          undefined
        )
      ).toEqual({ id: 7 });
    });

    it("throws MistApiError for an HTTP 200 expected business rejection", () => {
      expect(() =>
        parseEnvelope(
          {
            success: false,
            statusCode: 200,
            code: "BACKTEST_QUEUE_FULL",
            message: "queue full",
            data: { capacity: 100 },
            timestamp: "2026-08-03T00:00:00.000Z",
            requestId: "http-biz",
            path: "/v1/strategy-backtests",
          },
          200,
          undefined
        )
      ).toThrow(MistApiError);
    });

    it("throws MistApiError for a valid non-2xx technical error (400/500/502)", () => {
      for (const [status, code] of [
        [400, "BAD_REQUEST"],
        [500, "INTERNAL_ERROR"],
        [502, "BAD_GATEWAY"],
      ] as const) {
        expect(() =>
          parseEnvelope(
            {
              success: false,
              statusCode: status,
              code,
              message: "fail",
              timestamp: "2026-08-03T00:00:00.000Z",
              requestId: `http-${status}`,
              path: "/v1/securities",
            },
            status,
            undefined
          )
        ).toThrow(MistApiError);
      }
    });

    it("rejects a bare payload (array) as a contract error", () => {
      expect(() => parseEnvelope([{ code: "000001" }], 200, undefined)).toThrow(
        MistApiContractError
      );
    });

    it("rejects a bare payload (primitive) as a contract error", () => {
      expect(() => parseEnvelope(42, 200, undefined)).toThrow(MistApiContractError);
    });

    it("rejects a non-object body", () => {
      expect(() => parseEnvelope("not an object", 200, undefined)).toThrow(
        MistApiContractError
      );
    });

    it("rejects a missing required field", () => {
      expect(() =>
        parseEnvelope(
          {
            success: true,
            statusCode: 200,
            message: "SUCCESS",
            data: null,
            // timestamp missing
            requestId: "http-1",
            path: "/v1/securities",
          },
          200,
          undefined
        )
      ).toThrow(MistApiContractError);
    });

    it("rejects a known field with the wrong type", () => {
      expect(() =>
        parseEnvelope(
          {
            success: "true",
            statusCode: 200,
            message: "SUCCESS",
            data: null,
            timestamp: "2026-08-03T00:00:00.000Z",
            requestId: "http-1",
            path: "/v1/securities",
          },
          200,
          undefined
        )
      ).toThrow(MistApiContractError);
    });

    it("rejects when body statusCode disagrees with the real HTTP status", () => {
      expect(() =>
        parseEnvelope(
          {
            success: false,
            statusCode: 404,
            code: "NOT_FOUND",
            message: "missing",
            timestamp: "2026-08-03T00:00:00.000Z",
            requestId: "http-1",
            path: "/v1/securities",
          },
          200,
          undefined
        )
      ).toThrow(MistApiContractError);
    });

    it("tolerates additive unknown fields while still validating known ones", () => {
      expect(
        parseEnvelope(
          {
            success: true,
            statusCode: 200,
            message: "SUCCESS",
            data: { code: "600519" },
            timestamp: "2026-08-03T00:00:00.000Z",
            requestId: "http-1",
            path: "/v1/securities",
            traceId: "trace-xyz",
            serverVersion: "1.2.3",
          },
          200,
          undefined
        )
      ).toEqual({ code: "600519" });
    });

    it("preserves code/httpStatus/requestId/data/errors on the thrown API error", () => {
      try {
        parseEnvelope(
          {
            success: false,
            statusCode: 400,
            code: "VALIDATION_ERROR",
            message: "Request validation failed",
            data: { field: "code" },
            errors: { code: ["must not be empty"] },
            timestamp: "2026-08-03T00:00:00.000Z",
            requestId: "http-val",
            path: "/v1/securities",
          },
          400,
          undefined
        );
        throw new Error("expected parseEnvelope to throw");
      } catch (err) {
        expect(err).toBeInstanceOf(MistApiError);
        const apiError = err as MistApiError;
        expect(apiError.code).toBe("VALIDATION_ERROR");
        expect(apiError.httpStatus).toBe(400);
        expect(apiError.requestId).toBe("http-val");
        expect(apiError.errors).toEqual({ code: ["must not be empty"] });
        expect(apiError.message).toBe("Request validation failed");
      }
    });
  });

  describe("requestJson strict behavior", () => {
    it("loads securities from a valid HTTP 200 success envelope", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        successEnvelope([
          { code: "600519", name: "贵州茅台", type: "stock", status: 1 },
        ])
      );

      await expect(fetchSecurities()).resolves.toEqual([
        { code: "600519", name: "贵州茅台", type: "stock", status: 1 },
      ]);
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/mist/v1/securities",
        expect.objectContaining({ method: "GET" })
      );
    });

    it("unwraps an HTTP 201 created success envelope", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        successEnvelope({ id: 7, name: "x" }, { status: 201 })
      );

      await expect(
        createStrategyDefinition({
          name: "x",
          targetUniverse: [],
          periods: [],
          sources: [],
          rule: {},
        })
      ).resolves.toEqual({ id: 7, name: "x" });
    });

    it("throws MistApiError on a valid HTTP 200 business rejection", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        errorEnvelope({
          status: 200,
          code: "BACKTEST_QUEUE_FULL",
          message: "queue full",
          data: { capacity: 100 },
        })
      );

      await expect(
        createStrategyBacktest({
          strategyVersionId: 1,
          targetUniverse: [],
          period: 1440,
          source: "tdx",
          startDate: "2026-01-01",
          endDate: "2026-06-30",
        })
      ).rejects.toMatchObject({
        name: "MistApiError",
        code: "BACKTEST_QUEUE_FULL",
        httpStatus: 200,
        message: "queue full",
      });
    });

    it("throws MistApiError on a valid 400 validation error", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        errorEnvelope({
          status: 400,
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          errors: { period: ["must be positive"] },
        })
      );

      await expect(fetchSecurities()).rejects.toMatchObject({
        name: "MistApiError",
        code: "VALIDATION_ERROR",
        httpStatus: 400,
        errors: { period: ["must be positive"] },
      });
    });

    it("throws MistApiError on a valid 500 and 502 technical error", async () => {
      for (const [status, code] of [
        [500, "INTERNAL_ERROR"],
        [502, "BAD_GATEWAY"],
      ] as const) {
        (global.fetch as jest.Mock).mockResolvedValueOnce(
          errorEnvelope({ status, code, message: "boom" })
        );
        await expect(fetchSecurities()).rejects.toMatchObject({
          name: "MistApiError",
          code,
          httpStatus: status,
        });
      }
    });

    it("throws MistApiContractError on a bare payload (no envelope)", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        mockResponse([{ code: "000001" }], { status: 200 })
      );

      await expect(fetchSecurities()).rejects.toBeInstanceOf(MistApiContractError);
    });

    it("throws MistApiContractError on invalid JSON", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 400,
        headers: new Headers({ "x-request-id": "http-bad-json" }),
        json: async () => {
          throw new SyntaxError("Unexpected token");
        },
      });

      await expect(fetchSecurities()).rejects.toBeInstanceOf(MistApiContractError);
    });

    it("throws MistApiContractError on a missing-field envelope", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        mockResponse(
          {
            success: true,
            statusCode: 200,
            message: "SUCCESS",
            data: [],
            // timestamp / requestId / path missing
          },
          { status: 200 }
        )
      );

      await expect(fetchSecurities()).rejects.toBeInstanceOf(MistApiContractError);
    });

    it("throws MistApiContractError on a status mismatch", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        mockResponse(
          {
            success: false,
            statusCode: 404,
            code: "NOT_FOUND",
            message: "missing",
            timestamp: "2026-08-03T00:00:00.000Z",
            requestId: "http-1",
            path: "/v1/securities",
          },
          { status: 200 }
        )
      );

      await expect(fetchSecurities()).rejects.toBeInstanceOf(MistApiContractError);
    });

    it("tolerates additive unknown fields on a success response", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        mockResponse(
          {
            success: true,
            statusCode: 200,
            message: "SUCCESS",
            data: [{ code: "600519" }],
            timestamp: "2026-08-03T00:00:00.000Z",
            requestId: "http-1",
            path: "/v1/securities",
            serverVersion: "1.2.3",
            traceId: "trace-xyz",
          },
          { status: 200, headers: { "x-request-id": "http-1" } }
        )
      );

      await expect(fetchSecurities()).resolves.toEqual([{ code: "600519" }]);
    });

    it("fail-closes a data-returning request that receives HTTP 204", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        mockResponse(null, {
          status: 204,
          headers: { "x-request-id": "http-no-content" },
        })
      );

      await expect(fetchSecurities()).rejects.toBeInstanceOf(MistApiContractError);
    });
  });

  describe("requestNoContent", () => {
    it("accepts HTTP 204 without parsing JSON and returns the request id", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        mockResponse(null, {
          status: 204,
          headers: { "x-request-id": "http-204" },
        })
      );

      const result = await requestNoContent(
        getMistApiBase(),
        "/v1/example/no-content",
        { method: "POST" }
      );

      expect(result).toEqual({ requestId: "http-204" });
      // json() is never invoked; only fetch was called.
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it("fails closed when the response is not 204", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        successEnvelope({ id: 1 }, { status: 200 })
      );

      await expect(
        requestNoContent(getMistApiBase(), "/v1/example/no-content", {
          method: "POST",
        })
      ).rejects.toBeInstanceOf(MistApiContractError);
    });
  });

  it("collects K-lines through the Mist backend with the selected query", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      successEnvelope({ code: "600519", period: 1440, count: 2 })
    );

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

  it("fetches K-lines from the analysis API via the success envelope", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      successEnvelope([
        {
          id: 1,
          symbol: "600519",
          time: "2026-06-30T00:00:00.000Z",
          amount: 1000,
          open: 1,
          close: 2,
          high: 3,
          low: 0.5,
        },
      ])
    );

    const result = await fetchK({
      code: "600519",
      source: "tdx",
      period: 1440,
      startDate: "2026-01-01",
      endDate: "2026-06-30",
    });

    expect(result[0]).toMatchObject({ high: 3, low: 0.5 });
    expect(result[0]).not.toHaveProperty("highest");
    expect(result[0]).not.toHaveProperty("lowest");

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
    (global.fetch as jest.Mock).mockResolvedValue(successEnvelope([]));

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

  it("normalizes an array bi envelope into both phases", async () => {
    const array = [{ startTime: "2026-01-01", endTime: "2026-01-02" }];
    (global.fetch as jest.Mock).mockResolvedValue(successEnvelope(array));

    await expect(
      fetchBi({
        code: "600519",
        source: "tdx",
        period: 1440,
        startDate: "2026-01-01",
        endDate: "2026-06-30",
      })
    ).resolves.toEqual({ phaseA: array, phaseB: array });
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
      .mockResolvedValueOnce(successEnvelope(canonical))
      .mockResolvedValueOnce(successEnvelope({ phaseA: [] }));

    await expect(fetchBi(query)).resolves.toEqual(canonical);
    await expect(fetchBi(query)).rejects.toThrow(
      "bi response must be an array or contain phaseA and phaseB arrays"
    );
  });

  it("normalizes an array channel envelope into both phases", async () => {
    const array = [{ startId: 1, endId: 5 }];
    (global.fetch as jest.Mock).mockResolvedValue(successEnvelope(array));

    await expect(
      fetchChannel({
        code: "600519",
        source: "tdx",
        period: 1440,
        startDate: "2026-01-01",
        endDate: "2026-06-30",
      })
    ).resolves.toEqual({ phaseA: array, phaseB: array });
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
      .mockResolvedValueOnce(successEnvelope(canonical))
      .mockResolvedValueOnce(successEnvelope({ phaseA: [] }));

    await expect(fetchChannel(query)).resolves.toEqual(canonical);
    await expect(fetchChannel(query)).rejects.toThrow(
      "channel response must be an array or contain phaseA and phaseB arrays"
    );
  });

  it("calls strategy registry endpoints through the Mist v1 gateway path", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(successEnvelope([]));

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
    (global.fetch as jest.Mock).mockResolvedValue(successEnvelope([]));

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
    (global.fetch as jest.Mock).mockResolvedValue(successEnvelope([]));

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
