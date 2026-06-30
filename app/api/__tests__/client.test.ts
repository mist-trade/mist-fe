import {
  collectKLines,
  fetchBi,
  fetchChannel,
  fetchFenxing,
  fetchK,
  fetchMergeK,
  fetchSecurities,
  getAnalysisApiBase,
  getMistApiBase,
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
      "/api/mist/security/v1/all",
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
      "/api/chan/indicator/k",
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
      "/api/chan/chan/merge-k",
      expect.objectContaining({ method: "POST", body: JSON.stringify(query) })
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      "/api/chan/chan/bi",
      expect.objectContaining({ method: "POST", body: JSON.stringify(query) })
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      3,
      "/api/chan/chan/fenxing",
      expect.objectContaining({ method: "POST", body: JSON.stringify(query) })
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      4,
      "/api/chan/chan/channel",
      expect.objectContaining({ method: "POST", body: JSON.stringify(query) })
    );
  });
});
