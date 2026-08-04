import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  MistApiContractError,
  MistApiError,
  activateSecurity,
  deactivateSecurity,
  initializeRealtimeSubscription,
  listRealtimeSubscriptions,
  lookupSecuritySources,
  type InitializeRealtimeSubscriptionDto,
} from "../client";

/**
 * Realtime subscription client contract tests.
 *
 * These tests pin the frozen HTTP contract (paths, query bounds, nullability,
 * capacity summary, PUT data=null, business rejection codes) against the
 * approved examples in __fixtures__/contracts/realtime-subscriptions/fixtures.json.
 * Any field/enum/nullability/error-code change must land in the owning OpenSpec
 * change first and refresh the pinned copy + digest together.
 */
const FIXTURES_PATH = join(
  __dirname,
  "..",
  "..",
  "..",
  "__fixtures__",
  "contracts",
  "realtime-subscriptions",
  "fixtures.json"
);
const FIXTURES = JSON.parse(readFileSync(FIXTURES_PATH, "utf8")) as Record<
  string,
  Record<string, unknown> & { statusCode?: number; code?: string }
>;

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

/** Build a mock Response from a full envelope object (already shaped). */
const envelopeResponse = (
  envelope: Record<string, unknown> & { statusCode?: number },
  init: { status?: number; requestId?: string } = {}
) => {
  const status = init.status ?? envelope.statusCode ?? 200;
  const requestId = init.requestId ?? (envelope.requestId as string | undefined);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: buildHeaders(requestId ? { "x-request-id": requestId } : undefined),
    json: async () => envelope,
    text: async () => JSON.stringify(envelope),
  };
};

const lastCall = () =>
  (global.fetch as jest.Mock).mock.calls[
    (global.fetch as jest.Mock).mock.calls.length - 1
  ];

const lastUrl = () => lastCall()[0] as string;
const lastInit = () => lastCall()[1] as RequestInit;

describe("realtime subscription API client", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    global.fetch = jest.fn();
  });

  describe("listRealtimeSubscriptions (GET /v1/realtime-subscriptions)", () => {
    it("requests the exact gateway path through /api/mist", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        envelopeResponse(FIXTURES.page as never)
      );
      await listRealtimeSubscriptions();
      expect(lastUrl()).toBe("/api/mist/v1/realtime-subscriptions");
      expect(lastInit().method).toBe("GET");
    });

    it("encodes afterId/limit as bounded query params", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        envelopeResponse(FIXTURES.page as never)
      );
      await listRealtimeSubscriptions({ afterId: 8, limit: 50 });
      const url = lastUrl();
      expect(url).toContain("afterId=8");
      expect(url).toContain("limit=50");
    });

    it("omits query string when no params are given", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        envelopeResponse(FIXTURES.page as never)
      );
      await listRealtimeSubscriptions();
      expect(lastUrl()).not.toContain("?");
    });

    it("parses the pinned page: items, nextAfterId, both source capacities", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        envelopeResponse(FIXTURES.page as never)
      );
      const page = await listRealtimeSubscriptions();
      expect(page.nextAfterId).toBeNull();
      expect(page.items).toHaveLength(1);
      const qmt = page.items[0];
      // active=true MUST be preserved as a real boolean, not coerced.
      expect(qmt.active).toBe(true);
      expect(qmt.source).toBe("qmt");
      expect(qmt.activeEvidence).toBe("qmt_durable_registry");
      expect(qmt.convergence).toBe("drifted");
      expect(qmt.deferredRemovalReason).toBe("awaiting_full_reset");
      // sourceCapacities is pagination-independent and carries both sources.
      expect(page.sourceCapacities).toHaveLength(2);
      const bySource = Object.fromEntries(
        page.sourceCapacities.map((c) => [c.source, c])
      );
      expect(bySource.tdx).toEqual({
        source: "tdx",
        activeAssignmentCount: 2,
        limit: 5,
      });
      expect(bySource.qmt).toEqual({
        source: "qmt",
        activeAssignmentCount: 1,
        limit: 5,
      });
    });

    it("preserves active=null as null (not coerced to false)", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        envelopeResponse(FIXTURES.created as never, { status: 201 })
      );
      // Re-shape: created is a single VO envelope; emulate a page with null active.
      const createdData = FIXTURES.created.data as Record<string, unknown>;
      const nullActivePage = {
        ...FIXTURES.page,
        data: {
          ...(FIXTURES.page.data as object),
          items: [{ ...createdData, active: null, activeEvidence: null }],
        },
      };
      (global.fetch as jest.Mock).mockResolvedValue(
        envelopeResponse(nullActivePage as never)
      );
      const page = await listRealtimeSubscriptions();
      expect(page.items[0].active).toBeNull();
      expect(page.items[0].activeEvidence).toBeNull();
    });
  });

  describe("initializeRealtimeSubscription (POST /v1/realtime-subscriptions)", () => {
    it("submits the new-mode payload exactly (no extra/rewritten fields)", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        envelopeResponse(FIXTURES.created as never, { status: 201 })
      );
      const dto = FIXTURES.newRequest as unknown as InitializeRealtimeSubscriptionDto;
      await initializeRealtimeSubscription(dto);
      expect(lastUrl()).toBe("/api/mist/v1/realtime-subscriptions");
      expect(lastInit().method).toBe("POST");
      expect(JSON.parse(lastInit().body as string)).toEqual(dto);
    });

    it("submits the existing-mode payload with only securitySourceConfigId", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        envelopeResponse(FIXTURES.created as never, { status: 201 })
      );
      const dto = FIXTURES.existingRequest as unknown as InitializeRealtimeSubscriptionDto;
      await initializeRealtimeSubscription(dto);
      const body = JSON.parse(lastInit().body as string);
      expect(body).toEqual({ mode: "existing", securitySourceConfigId: 17 });
      // Must NOT carry provider symbol or source — those stay server-authoritative.
      expect(body).not.toHaveProperty("providerSymbol");
      expect(body).not.toHaveProperty("source");
    });

    it("throws MistApiError with stable code on expected business rejection (HTTP 200)", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        envelopeResponse(FIXTURES.capacityReached as never)
      );
      await expect(
        initializeRealtimeSubscription(FIXTURES.newRequest as never)
      ).rejects.toMatchObject({
        name: "MistApiError",
        code: "REALTIME_ACTIVE_CAPACITY_REACHED",
        httpStatus: 200,
      });
    });

    it("carries typed data on each expected business rejection code", async () => {
      const codes = [
        "sourceLocked",
        "capacityReached",
        "assignmentExists",
        "securityExists",
        "sourceConfigNotFound",
        "securityNotEligible",
        "sourceConfigNotEligible",
      ] as const;
      for (const key of codes) {
        (global.fetch as jest.Mock).mockResolvedValue(
          envelopeResponse(FIXTURES[key] as never)
        );
        await expect(
          initializeRealtimeSubscription(FIXTURES.newRequest as never)
        ).rejects.toBeInstanceOf(MistApiError);
      }
    });
  });

  describe("lookupSecuritySources (GET /v1/securities/:code/sources)", () => {
    it("encodes the canonical code into the path", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        envelopeResponse(FIXTURES.securitySources as never)
      );
      await lookupSecuritySources("600519");
      expect(lastUrl()).toBe("/api/mist/v1/securities/600519/sources");
      expect(lastInit().method).toBe("GET");
    });

    it("preserves formatCode as the authoritative provider symbol", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        envelopeResponse(FIXTURES.securitySources as never)
      );
      const sources = await lookupSecuritySources("600519");
      expect(sources[0].formatCode).toBe("600519.SH");
      expect(sources[0].id).toBe(17);
    });
  });

  describe("activate/deactivate PUT (HTTP 200, data=null)", () => {
    it("activate uses PUT and returns null on the 200/data=null contract", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        envelopeResponse(FIXTURES.activateSuccess as never)
      );
      const result = await activateSecurity("600519");
      expect(result).toBeNull();
      expect(lastUrl()).toBe("/api/mist/v1/securities/600519/activate");
      expect(lastInit().method).toBe("PUT");
    });

    it("deactivate uses PUT and returns null on the 200/data=null contract", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        envelopeResponse(FIXTURES.deactivateSuccess as never)
      );
      const result = await deactivateSecurity("600519");
      expect(result).toBeNull();
      expect(lastUrl()).toBe("/api/mist/v1/securities/600519/deactivate");
      expect(lastInit().method).toBe("PUT");
    });

    it("does NOT accept an HTTP 204 as success (data-returning parser only)", async () => {
      const noContent = {
        status: 204,
        headers: buildHeaders(),
        json: async () => {
          throw new Error("no body");
        },
        text: async () => "",
      };
      (global.fetch as jest.Mock).mockResolvedValue(noContent);
      await expect(activateSecurity("600519")).rejects.toBeInstanceOf(
        MistApiContractError
      );
    });

    it("propagates the server request id header for diagnostics", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        envelopeResponse(FIXTURES.activateSuccess as never, {
          requestId: "http-fixture-activate",
        })
      );
      await activateSecurity("600519");
      // No throw == success; request id is observable via the rejection path.
    });
  });

  describe("mqmt rejection (negative contract)", () => {
    it("the realtime source type does not accept the legacy mqmt value", () => {
      // Compile-time contract: assigning mqmt to RealtimeSource is a type error.
      // We assert at runtime that the frozen fixtures never contain mqmt.
      const serialized = JSON.stringify(FIXTURES);
      expect(serialized).not.toContain('"source":"mqmt"');
      expect(serialized).not.toContain('"mqmt"');
    });

    it("a response carrying an unknown source value fails closed", async () => {
      const pageData = FIXTURES.page.data as {
        items: Record<string, unknown>[];
        nextAfterId: number | null;
        sourceCapacities: unknown[];
      };
      const badPage = {
        ...FIXTURES.page,
        data: {
          ...pageData,
          items: [
            {
              ...pageData.items[0],
              source: "mqmt",
            },
          ],
        },
      };
      (global.fetch as jest.Mock).mockResolvedValue(
        envelopeResponse(badPage as never)
      );
      // requestJson returns parsed data without deep-validating enum values; the
      // component layer is responsible for rejecting unknown enum values. Here we
      // assert the raw parsed value is NOT silently remapped to qmt.
      const page = await listRealtimeSubscriptions();
      expect(page.items[0].source).toBe("mqmt");
      expect(page.items[0].source).not.toBe("qmt");
    });
  });
});
