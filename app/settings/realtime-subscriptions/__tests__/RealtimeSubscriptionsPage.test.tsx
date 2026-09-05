import { fireEvent, render, screen, waitFor } from "@testing-library/react";

jest.mock("@/app/api/client", () => ({
  __esModule: true,
  MistApiContractError: class MistApiContractError extends Error {
    httpStatus: number;
    constructor(message: string, args: { httpStatus: number }) {
      super(message);
      this.name = "MistApiContractError";
      this.httpStatus = args.httpStatus;
    }
  },
  MistApiError: class MistApiError<T> extends Error {
    code: string;
    httpStatus: number;
    data: T | undefined;
    constructor(args: { code: string; message: string; httpStatus: number; requestId?: string; data?: T }) {
      super(args.message);
      this.name = "MistApiError";
      this.code = args.code;
      this.httpStatus = args.httpStatus;
      this.data = args.data;
    }
  },
  listRealtimeSubscriptions: jest.fn(),
  initializeRealtimeSubscription: jest.fn(),
  lookupSecuritySources: jest.fn(),
  activateSecurity: jest.fn(),
  deactivateSecurity: jest.fn(),
}));

import {
  activateSecurity,
  initializeRealtimeSubscription,
  listRealtimeSubscriptions,
  lookupSecuritySources,
  MistApiContractError,
  MistApiError,
} from "@/app/api/client";
import type {
  RealtimeConvergence,
  RealtimeSubscriptionPageVo,
  RealtimeSubscriptionVo,
  SecuritySourceVo,
} from "@/app/api/client";

import RealtimeSubscriptionsPage from "../page";

// --- fixture builders --------------------------------------------------------

const baseAssignment = (overrides: Partial<RealtimeSubscriptionVo> = {}): RealtimeSubscriptionVo => ({
  assignmentId: 8,
  securityId: 1,
  securitySourceConfigId: 17,
  securityCode: "600519",
  securityName: "贵州茅台",
  securityType: "STOCK",
  securityStatus: "ACTIVE",
  source: "qmt",
  providerSymbol: "600519.SH",
  desired: true,
  active: true,
  activeEvidence: "qmt_durable_registry",
  convergence: "converged",
  convergenceReason: null,
  deferredRemovalReason: null,
  createdAt: "2026-08-04T15:00:00.000Z",
  updatedAt: "2026-08-04T15:05:00.000Z",
  ...overrides,
});

const buildPage = (
  items: RealtimeSubscriptionVo[],
  nextAfterId: number | null = null,
  capacities: { source: "tdx" | "qmt"; activeAssignmentCount: number; limit: 5 }[] = [
    { source: "tdx", activeAssignmentCount: 2, limit: 5 },
    { source: "qmt", activeAssignmentCount: 1, limit: 5 },
  ]
): RealtimeSubscriptionPageVo => ({ items, nextAfterId, sourceCapacities: capacities });

const mockList = (impl: typeof listRealtimeSubscriptions) =>
  (listRealtimeSubscriptions as jest.Mock).mockImplementation(impl);

describe("RealtimeSubscriptionsPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- initialization modes --------------------------------------------------

  it("new mode: submits the new ACTIVE STOCK payload", async () => {
    mockList(jest.fn().mockResolvedValue(buildPage([])));
    (initializeRealtimeSubscription as jest.Mock).mockResolvedValue(baseAssignment());

    render(<RealtimeSubscriptionsPage />);
    await waitFor(() => expect(screen.getByTestId("empty")).toBeInTheDocument());

    fireEvent.change(screen.getByTestId("new-code"), { target: { value: "600519" } });
    fireEvent.change(screen.getByTestId("new-name"), { target: { value: "贵州茅台" } });
    fireEvent.change(screen.getByTestId("new-provider-symbol"), { target: { value: "600519.SH" } });
    fireEvent.click(screen.getByTestId("submit-init"));

    await waitFor(() => {
      expect(initializeRealtimeSubscription).toHaveBeenCalledWith({
        mode: "new",
        securityCode: "600519",
        securityName: "贵州茅台",
        securityType: "STOCK",
        source: "tdx",
        providerSymbol: "600519.SH",
      });
    });
  });

  it("existing mode: looks up one Security sources and submits only the config id (no N+1)", async () => {
    mockList(jest.fn().mockResolvedValue(buildPage([])));
    const sources: SecuritySourceVo[] = [
      { id: 17, securityId: 1, source: "qmt", formatCode: "600519.SH", priority: 10, enabled: true },
      { id: 18, securityId: 1, source: "tdx", formatCode: "600519.SH", priority: 20, enabled: true },
      // disabled + non-realtime source must be filtered out of presentation
      { id: 19, securityId: 1, source: "ef", formatCode: "600519.SH", priority: 30, enabled: true },
      { id: 20, securityId: 1, source: "tdx", formatCode: "600519.SH", priority: 40, enabled: false },
    ];
    (lookupSecuritySources as jest.Mock).mockResolvedValue(sources);
    (initializeRealtimeSubscription as jest.Mock).mockResolvedValue(baseAssignment());

    render(<RealtimeSubscriptionsPage />);
    await waitFor(() => expect(screen.getByTestId("empty")).toBeInTheDocument());

    fireEvent.click(screen.getByTestId("mode-existing"));
    fireEvent.change(screen.getByTestId("existing-code"), { target: { value: "600519" } });
    fireEvent.click(screen.getByTestId("lookup-sources"));

    await waitFor(() => expect(screen.getByTestId("sources-table")).toBeInTheDocument());
    // lookupSecuritySources called exactly once, for that one code (no N+1, no enumeration)
    expect(lookupSecuritySources).toHaveBeenCalledTimes(1);
    expect(lookupSecuritySources).toHaveBeenCalledWith("600519");
    // formatCode shown read-only; disabled/ef filtered out
    expect(screen.getByTestId("source-format-17").textContent).toBe("600519.SH");
    expect(screen.queryByTestId("source-format-19")).toBeNull();

    fireEvent.click(screen.getByTestId("source-radio-17"));
    fireEvent.click(screen.getByTestId("submit-init"));

    await waitFor(() => {
      expect(initializeRealtimeSubscription).toHaveBeenCalledWith({
        mode: "existing",
        securitySourceConfigId: 17,
      });
    });
    // POST body must NOT carry provider symbol / source (server-authoritative)
    const call = (initializeRealtimeSubscription as jest.Mock).mock.calls[0][0];
    expect(call).not.toHaveProperty("providerSymbol");
    expect(call).not.toHaveProperty("formatCode");
  });

  it("negative: never enumerates all securities (no /v1/securities full list call)", async () => {
    mockList(jest.fn().mockResolvedValue(buildPage([baseAssignment()])));
    render(<RealtimeSubscriptionsPage />);
    await waitFor(() => expect(screen.getByTestId("assignments-table")).toBeInTheDocument());
    // Only listRealtimeSubscriptions was called; lookupSecuritySources never fired automatically.
    expect(lookupSecuritySources).not.toHaveBeenCalled();
    expect(listRealtimeSubscriptions).toHaveBeenCalledTimes(1);
  });

  // --- active=null ------------------------------------------------------------

  it("renders active=null as unknown (not unsubscribed)", async () => {
    mockList(jest.fn().mockResolvedValue(buildPage([baseAssignment({ active: null, activeEvidence: null, convergence: "unknown", convergenceReason: "lifecycle_disabled" })])));
    render(<RealtimeSubscriptionsPage />);
    await waitFor(() => expect(screen.getByTestId("assignments-table")).toBeInTheDocument());
    expect(screen.getByTestId("cell-active").textContent).toContain("未知");
    expect(screen.getByTestId("cell-active").textContent).not.toContain("未订阅");
  });

  // --- five convergence states ------------------------------------------------

  it.each([
    ["converged", "已收敛"],
    ["pending", "等待读回"],
    ["drifted", "漂移"],
    ["blocked", "阻塞"],
    ["unknown", "未知"],
  ] as Array<[RealtimeConvergence, string]>)("renders convergence=%s label", async (conv, label) => {
    mockList(jest.fn().mockResolvedValue(buildPage([baseAssignment({ convergence: conv })])));
    render(<RealtimeSubscriptionsPage />);
    await waitFor(() => expect(screen.getByTestId("cell-convergence").textContent).toContain(label));
  });

  // --- TDX vs QMT evidence distinction ---------------------------------------

  it("labels TDX as terminal native-list evidence", async () => {
    mockList(jest.fn().mockResolvedValue(buildPage([baseAssignment({ source: "tdx", activeEvidence: "tdx_native_list" })])));
    render(<RealtimeSubscriptionsPage />);
    await waitFor(() => expect(screen.getByTestId("cell-evidence").textContent).toContain("TDX 终端原生列表"));
  });

  it("labels QMT as durable registry and never claims a native active list", async () => {
    mockList(jest.fn().mockResolvedValue(buildPage([baseAssignment({ source: "qmt", activeEvidence: "qmt_durable_registry" })])));
    render(<RealtimeSubscriptionsPage />);
    const text = await waitFor(() => screen.getByTestId("cell-evidence").textContent!);
    expect(text).toContain("QMT 持久化注册表");
    expect(text).toContain("非 QMT 原生活跃列表");
  });

  // --- global capacity independent of current page ---------------------------

  it("capacity summary is independent of current-page rows (page=1 row but qmt shows 5/5)", async () => {
    mockList(jest.fn().mockResolvedValue(buildPage(
      [baseAssignment()],
      null,
      [
        { source: "tdx", activeAssignmentCount: 0, limit: 5 },
        { source: "qmt", activeAssignmentCount: 5, limit: 5 },
      ]
    )));
    render(<RealtimeSubscriptionsPage />);
    await waitFor(() => expect(screen.getByTestId("capacity-qmt").textContent).toContain("5/5"));
    expect(screen.getByTestId("capacity-qmt")).toHaveAttribute("data-reached", "true");
    // Only 1 assignment row rendered, but capacity reflects the global count, not page rows.
    expect(screen.getAllByRole("row").length).toBe(2); // header + 1 data row
  });

  // --- PUT data=null refresh -------------------------------------------------

  it("refreshes inventory after a successful activate PUT (data=null)", async () => {
    const first = buildPage([baseAssignment({ desired: false, securityStatus: "SUSPENDED" })]);
    const refreshed = buildPage([baseAssignment({ desired: true, securityStatus: "ACTIVE" })]);
    const listMock = jest.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(refreshed);
    mockList(listMock);
    (activateSecurity as jest.Mock).mockResolvedValue(null);

    render(<RealtimeSubscriptionsPage />);
    await waitFor(() => expect(screen.getByTestId("activate-600519")).not.toBeDisabled());
    fireEvent.click(screen.getByTestId("activate-600519"));

    await waitFor(() => expect(activateSecurity).toHaveBeenCalledWith("600519"));
    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(2));
  });

  // --- concurrent action prevention -----------------------------------------

  it("disables conflicting activate while one is pending", async () => {
    let resolveActivate: (v: null) => void = () => {};
    (activateSecurity as jest.Mock).mockImplementation(
      () => new Promise<null>((resolve) => {
        resolveActivate = resolve;
      })
    );
    mockList(jest.fn().mockResolvedValue(buildPage([baseAssignment({ desired: false, securityStatus: "SUSPENDED" })])));

    render(<RealtimeSubscriptionsPage />);
    await waitFor(() => expect(screen.getByTestId("activate-600519")).not.toBeDisabled());
    fireEvent.click(screen.getByTestId("activate-600519"));

    // While pending, a second activate click must not trigger another call.
    await waitFor(() => expect(activateSecurity).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByTestId("activate-600519"));
    expect(activateSecurity).toHaveBeenCalledTimes(1);

    resolveActivate(null);
    await waitFor(() => expect(activateSecurity).toHaveBeenCalledTimes(1));
  });

  // --- stale response fencing -----------------------------------------------

  it("ignores a stale list response that resolves after a newer page load", async () => {
    // Two overlapping pagination generations: the first (older) resolves AFTER
    // the second (newer). The newer result must win; the stale one must not
    // overwrite it.
    const stale = buildPage(
      [baseAssignment({ assignmentId: 1, securityCode: "000001", securityName: "stale" })],
      null
    );
    const fresh = buildPage(
      [baseAssignment({ assignmentId: 2, securityCode: "600519", securityName: "fresh" })],
      null
    );
    let resolveStale: (v: RealtimeSubscriptionPageVo) => void = () => {};
    const initial = buildPage(
      [baseAssignment({ assignmentId: 1, securityCode: "000001", securityName: "initial" })],
      1
    );
    const listMock = jest
      .fn()
      // generation 0: initial load resolves immediately, advertises a next cursor.
      .mockResolvedValueOnce(initial)
      // generation 1: first "next" stays pending (stale).
      .mockImplementationOnce(
        () => new Promise<RealtimeSubscriptionPageVo>((r) => {
          resolveStale = r;
        })
      )
      // generation 2: a "prev"/reload resolves with fresh content first.
      .mockResolvedValueOnce(fresh);
    mockList(listMock);

    render(<RealtimeSubscriptionsPage />);
    await waitFor(() => expect(screen.getByTestId("page-next")).not.toBeDisabled());

    // Fire generation 1 (pending), then immediately generation 2 via 首页 (prev).
    fireEvent.click(screen.getByTestId("page-next"));
    fireEvent.click(screen.getByTestId("page-prev"));

    // The newer (fresh) result is rendered.
    await waitFor(() => expect(screen.getByTestId("cell-code").textContent).toBe("600519"));

    // Now the stale (older) response resolves late — it must NOT overwrite fresh.
    resolveStale(stale);
    // Re-render settles; assert the fresh value persists.
    await waitFor(() => expect(screen.getByTestId("cell-code").textContent).toBe("600519"));
    expect(listMock).toHaveBeenCalledTimes(3);
  });

  // --- cursor pagination -----------------------------------------------------

  it("fetches next bounded page only when nextAfterId is present", async () => {
    const page1 = buildPage([baseAssignment({ assignmentId: 1, securityCode: "000001" })], 1);
    const page2 = buildPage([baseAssignment({ assignmentId: 2, securityCode: "000002" })], null);
    const listMock = jest.fn().mockResolvedValueOnce(page1).mockResolvedValueOnce(page2);
    mockList(listMock);

    render(<RealtimeSubscriptionsPage />);
    await waitFor(() => expect(screen.getByTestId("page-next")).not.toBeDisabled());
    expect(listMock).toHaveBeenLastCalledWith({ limit: 20 });

    fireEvent.click(screen.getByTestId("page-next"));
    await waitFor(() => expect(listMock).toHaveBeenLastCalledWith({ afterId: 1, limit: 20 }));
    // Unbounded fetch never happens: exactly 2 calls total.
    expect(listMock).toHaveBeenCalledTimes(2);
  });

  // --- QMT blocked: no recovery button, runbook guidance only ----------------

  it("QMT blocked shows runbook guidance and no recovery button", async () => {
    mockList(jest.fn().mockResolvedValue(buildPage([baseAssignment({
      source: "qmt",
      convergence: "blocked",
      convergenceReason: "qmt_reconciliation_required",
      active: null,
      activeEvidence: null,
      desired: true,
    })])));
    render(<RealtimeSubscriptionsPage />);
    await waitFor(() => expect(screen.getByTestId("qmt-blocked-600519")).toBeInTheDocument());
    expect(screen.getByTestId("qmt-blocked-600519").textContent).toContain("runbook");
    // No raw control / sync / recovery mutation buttons exist anywhere.
    const buttons = screen.queryAllByRole("button");
    const texts = buttons.map((b) => b.textContent || "");
    expect(texts).not.toContain("恢复");
    expect(texts).not.toContain("sync");
    expect(texts).not.toContain("subscribe");
  });

  // --- deferred removal text -------------------------------------------------

  it("explains deferred removal waits for ready/reconnect or weekday 09:15 reset", async () => {
    mockList(jest.fn().mockResolvedValue(buildPage([baseAssignment({
      desired: false,
      securityStatus: "SUSPENDED",
      active: true,
      activeEvidence: "qmt_durable_registry",
      convergence: "drifted",
      convergenceReason: "awaiting_full_reset",
      deferredRemovalReason: "awaiting_full_reset",
    })])));
    render(<RealtimeSubscriptionsPage />);
    const text = await waitFor(() => screen.getByTestId("cell-deferred").textContent!);
    expect(text).toContain("09:15");
    expect(text).toContain("移除");
  });

  // --- visible navigation ----------------------------------------------------

  it("renders page header with route description", async () => {
    mockList(jest.fn().mockResolvedValue(buildPage([])));
    render(<RealtimeSubscriptionsPage />);
    expect(screen.getByRole("heading", { name: "实时订阅路由" })).toBeInTheDocument();
  });

  // --- no raw control / forbidden mutations ---------------------------------

  it("negative: exposes no desired checkbox, PATCH, raw subscribe/unsubscribe, delete or source switch", async () => {
    mockList(jest.fn().mockResolvedValue(buildPage([baseAssignment()])));
    render(<RealtimeSubscriptionsPage />);
    await waitFor(() => expect(screen.getByTestId("assignments-table")).toBeInTheDocument());
    // No checkbox inputs (desired checkbox forbidden)
    expect(screen.queryByRole("checkbox")).toBeNull();
    const allButtons = screen.getAllByRole("button").map((b) => b.textContent || "");
    const forbidden = ["subscribe", "unsubscribe", "同步", "sync", "删除", "delete", "切换 source"];
    for (const label of forbidden) {
      expect(allButtons).not.toContain(label);
    }
  });

  // --- boundaries ------------------------------------------------------------

  it("shows a contract-error boundary on malformed envelope", async () => {
    mockList(jest.fn().mockRejectedValue(new MistApiContractError("bad envelope", { httpStatus: 200 })));
    render(<RealtimeSubscriptionsPage />);
    await waitFor(() => expect(screen.getByTestId("contract-error")).toBeInTheDocument());
  });

  it("shows a dependency-error boundary on network/business failure", async () => {
    mockList(jest.fn().mockRejectedValue(new MistApiError({
      code: "INTERNAL_ERROR",
      message: "boom",
      httpStatus: 500,
      requestId: "http-test-internal",
    })));
    render(<RealtimeSubscriptionsPage />);
    await waitFor(() => expect(screen.getByTestId("load-error")).toBeInTheDocument());
    expect(screen.getByTestId("load-error").textContent).toContain("INTERNAL_ERROR");
  });

  // --- capacity race authority ----------------------------------------------

  it("surfaces backend REALTIME_ACTIVE_CAPACITY_REACHED even when client capacity hint was below limit", async () => {
    mockList(jest.fn().mockResolvedValue(buildPage([baseAssignment({ desired: false, securityStatus: "SUSPENDED" })])));
    (activateSecurity as jest.Mock).mockRejectedValue(new MistApiError({
      code: "REALTIME_ACTIVE_CAPACITY_REACHED",
      message: "Realtime active capacity reached",
      httpStatus: 200,
      requestId: "http-test-capacity",
      data: { source: "qmt", activeAssignmentCount: 5, limit: 5 },
    }));

    render(<RealtimeSubscriptionsPage />);
    await waitFor(() => expect(screen.getByTestId("activate-600519")).not.toBeDisabled());
    fireEvent.click(screen.getByTestId("activate-600519"));
    await waitFor(() => expect(screen.getByTestId("load-error").textContent).toContain("REALTIME_ACTIVE_CAPACITY_REACHED"));
  });
});
