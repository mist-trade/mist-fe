"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  MistApiContractError,
  MistApiError,
  activateSecurity,
  deactivateSecurity,
  initializeRealtimeSubscription,
  listRealtimeSubscriptions,
  lookupSecuritySources,
  type InitializeRealtimeSubscriptionDto,
  type NewRealtimeSubscriptionDto,
  type RealtimeActiveEvidence,
  type RealtimeConvergence,
  type RealtimeSource,
  type RealtimeSubscriptionPageVo,
  type RealtimeSubscriptionVo,
  type SecuritySourceVo,
} from "@/app/api/client";

/**
 * Operator page for production realtime subscription routing assignments.
 *
 * Consumes only the frozen backend contract through /api/mist:
 *   - bounded GET/POST /v1/realtime-subscriptions (cursor pagination)
 *   - one-Security GET /v1/securities/:code/sources (existing binding only)
 *   - existing PUT /v1/securities/:code/activate|deactivate (HTTP 200, data=null)
 *
 * Forbidden mutations are intentionally absent: no desired checkbox, PATCH,
 * raw subscribe/unsubscribe/sync, assignment delete, source switch or
 * context-rebuild. QMT blocked convergence offers only runbook guidance, never
 * a recovery button.
 */

const REALTIME_SOURCES: readonly RealtimeSource[] = ["tdx", "qmt"];
/** Backend cursor default page size (contract: min 1, max 100, default 20). */
const DEFAULT_LIMIT = 20;

type InitMode = "new" | "existing";

const CONVERGENCE_LABEL: Record<RealtimeConvergence, string> = {
  converged: "已收敛",
  pending: "等待读回",
  drifted: "漂移",
  blocked: "阻塞",
  unknown: "未知",
};

const EVIDENCE_LABEL: Record<RealtimeActiveEvidence, string> = {
  tdx_native_list: "TDX 终端原生列表",
  qmt_durable_registry: "QMT 持久化注册表",
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  return value.replace("T", " ").replace(/\.\d+Z$/, "");
};

const activeLabel = (active: boolean | null): string => {
  if (active === null) return "未知（无读回）";
  return active ? "活跃" : "未活跃";
};

const desiredLabel = (desired: boolean, status: string): string =>
  `${status} / desired=${desired ? "true" : "false"}`;

const evidenceText = (evidence: RealtimeActiveEvidence | null): string => {
  if (!evidence) return "-";
  if (evidence === "qmt_durable_registry") {
    // QMT evidence is the durable registry; never claim a provider-native list.
    return `${EVIDENCE_LABEL[evidence]}（非 QMT 原生活跃列表）`;
  }
  return EVIDENCE_LABEL[evidence];
};

const deferredText = (reason: RealtimeSubscriptionVo["deferredRemovalReason"]): string => {
  if (!reason) return "";
  if (reason === "awaiting_full_reset") {
    return "已停用但 provider 仍活跃：移除等待 ready/reconnect 或工作日 09:15 全量重置。";
  }
  return reason;
};

export default function RealtimeSubscriptionsPage() {
  const [page, setPage] = useState<RealtimeSubscriptionPageVo | null>(null);
  const [afterId, setAfterId] = useState<number | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [contractError, setContractError] = useState(false);

  // Initialization form state.
  const [initMode, setInitMode] = useState<InitMode>("new");
  // new-mode fields
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newSource, setNewSource] = useState<RealtimeSource>("tdx");
  const [newProviderSymbol, setNewProviderSymbol] = useState("");
  // existing-mode fields
  const [existingCode, setExistingCode] = useState("");
  const [sources, setSources] = useState<SecuritySourceVo[]>([]);
  const [selectedSourceConfigId, setSelectedSourceConfigId] = useState<number | null>(null);
  const [sourcesLoading, setSourcesLoading] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");

  // Per-row pending guard: tracks the assignmentId (or securityId) with an
  // in-flight activate/deactivate so conflicting actions are disabled.
  const [pendingAction, setPendingAction] = useState<
    Record<string, "activate" | "deactivate">
  >({});

  // Stale-response fencing: each load/lookup/mutation increments a generation;
  // a response whose generation is older than the current one is ignored.
  const loadGenRef = useRef(0);
  const sourcesGenRef = useRef(0);

  const classifyError = (error: unknown): string => {
    if (error instanceof MistApiError) {
      return `业务拒绝 [${error.code}]：${error.message}`;
    }
    if (error instanceof MistApiContractError) {
      return `契约异常：${error.message}`;
    }
    return error instanceof Error ? error.message : String(error);
  };

  const refresh = useCallback(async (cursor?: number) => {
    const gen = ++loadGenRef.current;
    setIsLoading(true);
    setContractError(false);
    try {
      const result = await listRealtimeSubscriptions(
        cursor !== undefined ? { afterId: cursor, limit: DEFAULT_LIMIT } : { limit: DEFAULT_LIMIT }
      );
      if (gen !== loadGenRef.current) return; // stale response fencing
      setPage(result);
      setLoadError("");
    } catch (error) {
      if (gen !== loadGenRef.current) return;
      if (error instanceof MistApiContractError) setContractError(true);
      setLoadError(classifyError(error));
    } finally {
      if (gen === loadGenRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh(undefined);
  }, [refresh]);

  const handleNext = () => {
    if (page?.nextAfterId == null) return;
    const next = page.nextAfterId;
    setAfterId(next);
    void refresh(next);
  };

  const handlePrev = () => {
    // Cursor pagination is forward-only over assignmentId ASC; "prev" reloads
    // the first page. We do not maintain a back-stack to avoid unbounded state.
    setAfterId(undefined);
    void refresh(undefined);
  };

  const lookupSources = async () => {
    if (!/^\d{6}$/.test(existingCode)) {
      setSubmitError("请输入 6 位 canonical Security code。");
      return;
    }
    const gen = ++sourcesGenRef.current;
    setSourcesLoading(true);
    setSubmitError("");
    setSources([]);
    setSelectedSourceConfigId(null);
    try {
      const result = await lookupSecuritySources(existingCode);
      if (gen !== sourcesGenRef.current) return; // stale response fencing
      // Present only enabled tdx|qmt source configs; never enumerate all securities.
      const eligible = result.filter(
        (item) => item.enabled && (item.source === "tdx" || item.source === "qmt")
      );
      setSources(eligible);
      if (eligible.length === 0) {
        setSubmitError("该 Security 没有启用的 tdx/qmt source 配置。");
      }
    } catch (error) {
      if (gen !== sourcesGenRef.current) return;
      setSubmitError(classifyError(error));
    } finally {
      if (gen === sourcesGenRef.current) setSourcesLoading(false);
    }
  };

  const submitInitialization = async () => {
    setIsSubmitting(true);
    setSubmitError("");
    setSubmitSuccess("");
    let dto: InitializeRealtimeSubscriptionDto;
    if (initMode === "new") {
      if (!/^\d{6}$/.test(newCode)) {
        setSubmitError("securityCode 必须为 6 位数字。");
        setIsSubmitting(false);
        return;
      }
      if (!newName.trim()) {
        setSubmitError("securityName 不能为空。");
        setIsSubmitting(false);
        return;
      }
      if (!/^\d{6}\.(SH|SZ|BJ)$/.test(newProviderSymbol)) {
        setSubmitError("providerSymbol 必须形如 600519.SH。");
        setIsSubmitting(false);
        return;
      }
      const newDto: NewRealtimeSubscriptionDto = {
        mode: "new",
        securityCode: newCode,
        securityName: newName.trim(),
        securityType: "STOCK",
        source: newSource,
        providerSymbol: newProviderSymbol,
      };
      dto = newDto;
    } else {
      if (selectedSourceConfigId == null) {
        setSubmitError("请先查询并选择一个 source 配置。");
        setIsSubmitting(false);
        return;
      }
      // Existing binding submits ONLY the stable source-config id.
      dto = { mode: "existing", securitySourceConfigId: selectedSourceConfigId };
    }
    try {
      await initializeRealtimeSubscription(dto);
      setSubmitSuccess("初始化成功，已刷新当前页。");
      // Refresh the bounded current page after a successful POST.
      await refresh(afterId);
    } catch (error) {
      setSubmitError(classifyError(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleSecurity = async (
    assignment: RealtimeSubscriptionVo,
    action: "activate" | "deactivate"
  ) => {
    const key = String(assignment.securityId);
    // Per-row pending guard: prevent a conflicting second request.
    if (pendingAction[key]) return;
    setPendingAction((prev) => ({ ...prev, [key]: action }));
    try {
      if (action === "activate") {
        await activateSecurity(assignment.securityCode);
      } else {
        await deactivateSecurity(assignment.securityCode);
      }
      // Refresh bounded inventory after a successful PUT (data=null).
      await refresh(afterId);
    } catch (error) {
      // REALTIME_ACTIVE_CAPACITY_REACHED remains authoritative under races.
      setLoadError(classifyError(error));
    } finally {
      setPendingAction((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  // Pagination-independent capacity summary (counts ACTIVE globally, not page rows).
  const capacityFor = (source: RealtimeSource) =>
    page?.sourceCapacities.find((c) => c.source === source);
  const capacityReached = (source: RealtimeSource): boolean => {
    const cap = capacityFor(source);
    return !!cap && cap.activeAssignmentCount >= cap.limit;
  };

  const renderRow = (assignment: RealtimeSubscriptionVo) => {
    const key = String(assignment.securityId);
    const pending = pendingAction[key];
    const desiredIsTrue = assignment.desired;
    const canActivate = !desiredIsTrue && !pending && !capacityReached(assignment.source);
    const canDeactivate = desiredIsTrue && !pending;
    const isQmtBlocked =
      assignment.convergence === "blocked" && assignment.source === "qmt";

    return (
      <tr key={assignment.assignmentId} data-testid={`assignment-${assignment.securityCode}`}>
        <td data-testid="cell-code">{assignment.securityCode}</td>
        <td>{assignment.securityName}</td>
        <td data-testid="cell-desired">
          {desiredLabel(assignment.desired, assignment.securityStatus)}
        </td>
        <td data-testid="cell-active">{activeLabel(assignment.active)}</td>
        <td data-testid="cell-evidence">{evidenceText(assignment.activeEvidence)}</td>
        <td data-testid="cell-convergence">
          {CONVERGENCE_LABEL[assignment.convergence]}
          {assignment.convergenceReason ? `（${assignment.convergenceReason}）` : ""}
        </td>
        <td data-testid="cell-deferred">
          {deferredText(assignment.deferredRemovalReason) || "-"}
        </td>
        <td data-testid="cell-source">{assignment.source}</td>
        <td data-testid="cell-provider">{assignment.providerSymbol}</td>
        <td data-testid="cell-updated">{formatDateTime(assignment.updatedAt)}</td>
        <td data-testid="cell-actions">
          <button
            type="button"
            onClick={() => void toggleSecurity(assignment, "activate")}
            disabled={!canActivate}
            data-testid={`activate-${assignment.securityCode}`}
          >
            {pending === "activate" ? "激活中…" : "激活"}
          </button>
          <button
            type="button"
            onClick={() => void toggleSecurity(assignment, "deactivate")}
            disabled={!canDeactivate}
            data-testid={`deactivate-${assignment.securityCode}`}
          >
            {pending === "deactivate" ? "停用中…" : "停用"}
          </button>
          {isQmtBlocked ? (
            <span className="strategy-muted" data-testid={`qmt-blocked-${assignment.securityCode}`}>
              QMT 阻塞：请按批准的 source-scoped 恢复 runbook 处理（不提供恢复按钮）。
            </span>
          ) : null}
        </td>
      </tr>
    );
  };

  const hasMore = page?.nextAfterId != null;

  return (
    <main className="settings-realtime-subscriptions">
      <header className="strategy-header">
        <div>
          <h1>实时订阅路由</h1>
          <p className="strategy-muted">
            初始化、分页查看并激活/停用生产实时订阅 assignment。所有操作经 /api/mist，
            不暴露 datasource 或终端控制路径。
          </p>
        </div>
        <nav className="strategy-nav" aria-label="主导航">
          <a href="/k">K 线</a>
          <a href="/strategies">策略</a>
          <a href="/backtests">回测</a>
          <a href="/settings/realtime-subscriptions" aria-current="page">
            实时订阅
          </a>
        </nav>
      </header>

      {/* Capacity summary — pagination-independent, sourced from sourceCapacities. */}
      <section className="capacity-summary" aria-label="实时订阅容量">
        <h2>容量（与当前页无关）</h2>
        <div className="strategy-metrics">
          {REALTIME_SOURCES.map((source) => {
            const cap = capacityFor(source);
            const reached = capacityReached(source);
            return (
              <span
                key={source}
                className="capacity-pill"
                data-testid={`capacity-${source}`}
                data-reached={reached ? "true" : "false"}
              >
                {source}: {cap?.activeAssignmentCount ?? "-"}/{cap?.limit ?? "-"}
                {reached ? "（已满）" : ""}
              </span>
            );
          })}
        </div>
        <p className="strategy-muted">
          backend REALTIME_ACTIVE_CAPACITY_REACHED 在并发竞态下始终为权威结果。
        </p>
      </section>

      {/* Initialization. No desired checkbox / PATCH / raw control / delete / switch. */}
      <section className="init-panel" aria-label="初始化 assignment">
        <h2>初始化</h2>
        <div className="strategy-nav">
          <label>
            <input
              type="radio"
              name="init-mode"
              value="new"
              checked={initMode === "new"}
              onChange={() => setInitMode("new")}
              data-testid="mode-new"
            />{" "}
            新建 ACTIVE STOCK
          </label>
          <label>
            <input
              type="radio"
              name="init-mode"
              value="existing"
              checked={initMode === "existing"}
              onChange={() => setInitMode("existing")}
              data-testid="mode-existing"
            />{" "}
            绑定既有 source 配置
          </label>
        </div>

        {initMode === "new" ? (
          <div className="init-form" data-testid="new-form">
            <label>
              securityCode（6 位）
              <input
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                maxLength={6}
                pattern="^\d{6}$"
                data-testid="new-code"
              />
            </label>
            <label>
              securityName
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                data-testid="new-name"
              />
            </label>
            <label>
              source
              <select
                value={newSource}
                onChange={(e) => setNewSource(e.target.value as RealtimeSource)}
                data-testid="new-source"
              >
                {REALTIME_SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label>
              providerSymbol（如 600519.SH）
              <input
                value={newProviderSymbol}
                onChange={(e) => setNewProviderSymbol(e.target.value)}
                data-testid="new-provider-symbol"
              />
            </label>
            <p className="strategy-muted">securityType 固定为 STOCK（仅支持 ACTIVE 股票）。</p>
          </div>
        ) : (
          <div className="init-form" data-testid="existing-form">
            <label>
              canonical Security code（6 位）
              <input
                value={existingCode}
                onChange={(e) => setExistingCode(e.target.value)}
                maxLength={6}
                pattern="^\d{6}$"
                data-testid="existing-code"
              />
              <button
                type="button"
                onClick={() => void lookupSources()}
                disabled={sourcesLoading}
                data-testid="lookup-sources"
              >
                {sourcesLoading ? "查询中…" : "查询 sources"}
              </button>
            </label>
            <p className="strategy-muted">
              仅查询该 Security 的 source 配置；不遍历全部 Securities，不做 N+1。
            </p>
            {sources.length > 0 ? (
              <table data-testid="sources-table">
                <thead>
                  <tr>
                    <th>选择</th>
                    <th>id</th>
                    <th>source</th>
                    <th>formatCode（provider symbol，只读）</th>
                    <th>priority</th>
                  </tr>
                </thead>
                <tbody>
                  {sources.map((src) => (
                    <tr key={src.id}>
                      <td>
                        <input
                          type="radio"
                          name="source-config"
                          value={src.id}
                          checked={selectedSourceConfigId === src.id}
                          onChange={() => setSelectedSourceConfigId(src.id)}
                          data-testid={`source-radio-${src.id}`}
                        />
                      </td>
                      <td>{src.id}</td>
                      <td>{src.source}</td>
                      <td data-testid={`source-format-${src.id}`}>{src.formatCode}</td>
                      <td>{src.priority}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </div>
        )}

        <div className="strategy-actions">
          <button
            type="button"
            onClick={() => void submitInitialization()}
            disabled={isSubmitting}
            data-testid="submit-init"
          >
            {isSubmitting ? "提交中…" : "提交初始化"}
          </button>
          {submitSuccess ? (
            <span className="strategy-success" data-testid="submit-success">
              {submitSuccess}
            </span>
          ) : null}
          {submitError ? (
            <span className="strategy-error" data-testid="submit-error">
              {submitError}
            </span>
          ) : null}
        </div>
      </section>

      {/* Inventory — bounded cursor pagination. */}
      <section className="inventory" aria-label="assignment 分页列表">
        <div className="strategy-actions">
          <h2>路由 assignment（assignmentId 升序）</h2>
          <button
            type="button"
            onClick={handlePrev}
            disabled={afterId === undefined}
            data-testid="page-prev"
          >
            首页
          </button>
          <button
            type="button"
            onClick={handleNext}
            disabled={isLoading || !hasMore}
            data-testid="page-next"
          >
            下一页
          </button>
        </div>

        {isLoading ? (
          <p className="strategy-muted" data-testid="loading">
            正在加载…
          </p>
        ) : contractError ? (
          <p className="strategy-error" data-testid="contract-error">
            后端响应不符合冻结契约（malformed envelope）。请核对 backend 契约版本。
          </p>
        ) : loadError ? (
          <p className="strategy-error" data-testid="load-error">
            {loadError}
          </p>
        ) : !page || page.items.length === 0 ? (
          <p className="empty-state" data-testid="empty">
            暂无 realtime subscription assignment。
          </p>
        ) : (
          <table data-testid="assignments-table">
            <thead>
              <tr>
                <th>code</th>
                <th>name</th>
                <th>Security status / desired</th>
                <th>provider active</th>
                <th>active evidence</th>
                <th>convergence</th>
                <th>deferred removal</th>
                <th>source</th>
                <th>provider symbol</th>
                <th>updatedAt</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>{page.items.map(renderRow)}</tbody>
          </table>
        )}
      </section>
    </main>
  );
}
