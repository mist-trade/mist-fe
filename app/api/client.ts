import type {
  IFenxing,
  IFetchBiPhases,
  IFetchChannelPhases,
  IFetchDuan,
  IFetchDuanChannelPhases,
  IFetchK,
  IMergeK,
} from "./types";

const DEFAULT_MIST_API_BASE_PATH = "/api/mist";
const DEFAULT_CHAN_API_BASE_PATH = "/api/chan";

const TIMEOUT = Number.parseInt(
  process.env.NEXT_PUBLIC_API_TIMEOUT || "10000",
  10
);

/**
 * Backend `DataSource` enum wire values. The realtime subscription contract
 * restricts the public realtime source to exactly `tdx|qmt`; the legacy
 * `mqmt` value was renamed to `qmt` and MUST NOT be re-introduced as an alias
 * or silently remapped. `ef` remains for the historical/EastMoney K-line paths.
 */
export type DataSourceValue = "ef" | "tdx" | "qmt";
export type StrategyStatus = "draft" | "enabled" | "disabled" | "archived";
export type StrategyAlertStatus = "pending" | "delivered" | "acked" | "failed";
export type BacktestRunStatus = "pending" | "running" | "completed" | "failed";
export type StrategySignalSource = "live" | "backtest";
/**
 * Required signal kind declared by each immutable strategy version. A version
 * expresses exactly one signal intent (`entry` or `exit`); operators create a
 * separate definition when they need the other kind.
 */
export type StrategySignalKind = "entry" | "exit";

export interface KLineQuery {
  code: string;
  source?: DataSourceValue;
  period: number;
  startDate: string;
  endDate: string;
}

export interface SecurityOption {
  id?: number;
  code: string;
  name: string;
  type?: string;
  status?: number;
}

export interface CollectKLinesResult {
  code: string;
  period: number;
  count: number;
}

/**
 * Creation-only strategy definition payload. The backend atomically creates the
 * definition, its single immutable version 1 and the current-version pointer
 * from this request. There is no content-update contract; changed content must
 * be submitted as a new definition.
 */
export interface StrategyDefinitionPayload {
  name: string;
  description?: string;
  targetUniverse: string[];
  periods: number[];
  sources: DataSourceValue[];
  rule: Record<string, unknown>;
  signalKind: StrategySignalKind;
}

export interface StrategyDefinition {
  id: number;
  name: string;
  description?: string | null;
  status: StrategyStatus;
  targetUniverse: string[];
  periods: number[];
  sources: DataSourceValue[];
  currentVersionId?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface StrategyVersion {
  id: number;
  strategyDefinitionId: number;
  versionNumber: number;
  ruleSchemaVersion: string;
  rule: Record<string, unknown>;
  signalKind: StrategySignalKind;
  validationSummary?: Record<string, unknown>;
  createdAt?: string;
}

export interface StrategySignalQuery {
  strategyDefinitionId?: number;
  securityId?: number;
  period?: number;
  source?: DataSourceValue;
}

export interface StrategySignal {
  id: number;
  strategyDefinitionId: number;
  strategyVersionId: number;
  securityId: number;
  period: number;
  source: DataSourceValue;
  signalTime: string;
  signalSource: StrategySignalSource;
  signalKind: StrategySignalKind;
  contextSnapshot: Record<string, unknown>;
  ruleSnapshot: Record<string, unknown>;
  createdAt?: string;
}

export interface StrategyAlertEventQuery {
  status?: StrategyAlertStatus;
  strategySignalId?: number;
}

export interface StrategyAlertEvent {
  id: number;
  strategySignalId: number;
  status: StrategyAlertStatus;
  dedupeKey: string;
  cooldownUntil?: string | null;
  deliveryResult?: Record<string, unknown> | null;
  acknowledgedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface StrategyBacktestRequest {
  strategyVersionId: number;
  targetUniverse: string[];
  period: number;
  source: DataSourceValue;
  startDate: string;
  endDate: string;
}

export interface BacktestRunReceipt {
  runId: number;
  initialStatus: "PENDING" | string;
}

export interface BacktestSignalPageVo {
  items: StrategyBacktestSignalResult[];
  nextCursor?: string | null;
}

export interface StrategyBacktestRun {
  id: number;
  strategyDefinitionId: number;
  strategyVersionId: number;
  targetUniverse: string[];
  period: number;
  source: DataSourceValue;
  startDate: string;
  endDate: string;
  status: BacktestRunStatus;
  signalCount: number;
  matchedSecurityCount: number;
  startedAt?: string | null;
  completedAt?: string | null;
  errorMessage?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface StrategyBacktestSignalResult {
  id: number;
  backtestRunId: number;
  securityCode: string;
  signalTime: string;
  contextSnapshot: Record<string, unknown>;
  ruleSnapshot: Record<string, unknown>;
  createdAt?: string;
}

// ---------------------------------------------------------------------------
// Realtime subscription contract (frozen by integrate-production-realtime-
// subscription-lifecycle task 1.4). Pinned copies live under
// __fixtures__/contracts/realtime-subscriptions/ with SHA-256 sidecars.
// ---------------------------------------------------------------------------

/**
 * Public realtime source. The backend enum is exactly `tdx|qmt`; the legacy
 * `mqmt` value is invalid and must fail closed, never silently remapped.
 */
export type RealtimeSource = "tdx" | "qmt";

export type RealtimeSecurityStatus = "ACTIVE" | "SUSPENDED" | "DELISTED";

/**
 * Provider-specific active evidence. TDX evidence comes from the terminal
 * native list; QMT evidence comes from the verified durable registry and is
 * NOT a provider-native active list.
 */
export type RealtimeActiveEvidence = "tdx_native_list" | "qmt_durable_registry";

export type RealtimeConvergence =
  | "converged"
  | "pending"
  | "drifted"
  | "blocked"
  | "unknown";

export type RealtimeConvergenceReason =
  | "lifecycle_disabled"
  | "transport_not_ready"
  | "readback_stale"
  | "control_outcome_unknown"
  | "desired_missing_active"
  | "awaiting_full_reset"
  | "control_failed"
  | "qmt_reconciliation_required"
  | "qmt_journal_unhealthy"
  | "source_capacity_blocked";

export type RealtimeDeferredRemovalReason = "awaiting_full_reset";

/**
 * Realtime subscription routing assignment. `desired` is computed from
 * `securityStatus=ACTIVE` and is never writable here. `active` is the trusted
 * provider readback: `null` means no trustworthy current evidence and MUST NOT
 * be coerced to `false` or displayed as unsubscribed.
 */
export interface RealtimeSubscriptionVo {
  assignmentId: number;
  securityId: number;
  securitySourceConfigId: number;
  securityCode: string;
  securityName: string;
  securityType: "STOCK";
  securityStatus: RealtimeSecurityStatus;
  source: RealtimeSource;
  providerSymbol: string;
  desired: boolean;
  active: boolean | null;
  activeEvidence: RealtimeActiveEvidence | null;
  convergence: RealtimeConvergence;
  convergenceReason: RealtimeConvergenceReason | null;
  deferredRemovalReason: RealtimeDeferredRemovalReason | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Pagination-independent ACTIVE capacity summary for one source. `limit` is the
 * fixed backend per-source ACTIVE assignment cap (currently 5). Counts reflect
 * ACTIVE assignments globally, not the current page rows.
 */
export interface RealtimeSourceCapacityVo {
  source: RealtimeSource;
  activeAssignmentCount: number;
  limit: 5;
}

/**
 * Bounded assignment page. Cursor is `assignmentId ASC`; `nextAfterId` is
 * `null` when no further page exists. `sourceCapacities` always carries both
 * sources and is independent of the returned page.
 */
export interface RealtimeSubscriptionPageVo {
  items: RealtimeSubscriptionVo[];
  nextAfterId: number | null;
  sourceCapacities: RealtimeSourceCapacityVo[];
}

/**
 * Existing one-Security source config. `formatCode` is the authoritative
 * provider symbol; the operator UI displays it read-only and submits only the
 * stable `id` (`securitySourceConfigId`) when binding.
 */
export interface SecuritySourceVo {
  id: number;
  securityId: number;
  source: DataSourceValue;
  formatCode: string;
  priority: number;
  enabled: boolean;
}

/** Query for bounded realtime subscription assignment listing. */
export interface RealtimeSubscriptionQuery {
  afterId?: number;
  limit?: number;
}

/** New ACTIVE STOCK initialization request. */
export interface NewRealtimeSubscriptionDto {
  mode: "new";
  securityCode: string;
  securityName: string;
  securityType: "STOCK";
  source: RealtimeSource;
  providerSymbol: string;
}

/** Existing source-config binding request. Submits only the stable config ID. */
export interface ExistingRealtimeSubscriptionDto {
  mode: "existing";
  securitySourceConfigId: number;
}

export type InitializeRealtimeSubscriptionDto =
  | NewRealtimeSubscriptionDto
  | ExistingRealtimeSubscriptionDto;

/**
 * Stable realtime subscription business-rejection codes. Each maps to a typed
 * `data` shape on the shared error envelope (HTTP 200, success=false).
 */
export const REALTIME_SUBSCRIPTION_BUSINESS_CODES = [
  "REALTIME_SOURCE_LOCKED",
  "REALTIME_ACTIVE_CAPACITY_REACHED",
  "REALTIME_ASSIGNMENT_EXISTS",
  "REALTIME_SECURITY_EXISTS",
  "REALTIME_SOURCE_CONFIG_NOT_FOUND",
  "REALTIME_SECURITY_NOT_ELIGIBLE",
  "REALTIME_SOURCE_CONFIG_NOT_ELIGIBLE",
] as const;
export type RealtimeSubscriptionBusinessCode =
  (typeof REALTIME_SUBSCRIPTION_BUSINESS_CODES)[number];

export type RealtimeSecurityIneligibleReason =
  | "security_not_active"
  | "security_not_stock";
export type RealtimeSourceConfigIneligibleReason =
  | "source_not_realtime"
  | "source_disabled"
  | "provider_symbol_invalid";

/**
 * Validation error map returned by the backend on a `VALIDATION_ERROR` response.
 * Keys are stable dotted paths (including numeric array segments), values are
 * the human-readable constraint messages for that path.
 */
export type ApiEnvelopeErrors = Record<string, string[]>;

/**
 * Raised when the backend returns a valid error envelope (HTTP-200 expected
 * business rejection or a real non-2xx technical failure). The envelope's
 * `code` carries the stable machine-readable identifier; `httpStatus` mirrors
 * the real HTTP status for diagnostics only and MUST NOT drive business logic.
 */
export class MistApiError<TData = never> extends Error {
  readonly code: string;
  readonly httpStatus: number;
  readonly requestId: string;
  readonly data: TData | undefined;
  readonly errors: ApiEnvelopeErrors | undefined;

  constructor(args: {
    code: string;
    message: string;
    httpStatus: number;
    requestId: string;
    data?: TData;
    errors?: ApiEnvelopeErrors;
  }) {
    super(args.message);
    this.name = "MistApiError";
    this.code = args.code;
    this.httpStatus = args.httpStatus;
    this.requestId = args.requestId;
    this.data = args.data;
    this.errors = args.errors;
  }
}

/**
 * Raised when the response cannot be interpreted as the unified HTTP envelope:
 * non-JSON body, bare business payload, missing/typed-wrong required fields,
 * an error/success branch mismatch, or a body `statusCode` that disagrees with
 * the real HTTP status. This is a consumer/contract failure, never a server
 * declared API error, so it carries no stable `code`.
 */
export class MistApiContractError extends Error {
  readonly httpStatus: number;
  readonly requestId: string | undefined;

  constructor(message: string, args: { httpStatus: number; requestId?: string }) {
    super(message);
    this.name = "MistApiContractError";
    this.httpStatus = args.httpStatus;
    this.requestId = args.requestId;
  }
}

const REQUEST_ID_HEADER = "x-request-id";

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const envOrDefault = (
  urlName: string,
  pathName: string,
  fallbackPath: string
) => {
  const urlValue = process.env[urlName];
  if (urlValue) {
    return trimTrailingSlash(urlValue);
  }

  const pathValue = process.env[pathName];
  if (pathValue) {
    return trimTrailingSlash(pathValue);
  }

  return fallbackPath;
};

export const getMistApiBase = () =>
  envOrDefault(
    "NEXT_PUBLIC_MIST_API_BASE_URL",
    "NEXT_PUBLIC_MIST_API_BASE_PATH",
    DEFAULT_MIST_API_BASE_PATH
  );

export const getAnalysisApiBase = () => {
  const explicit = envOrDefault(
    "NEXT_PUBLIC_CHAN_API_BASE_URL",
    "NEXT_PUBLIC_CHAN_API_BASE_PATH",
    DEFAULT_CHAN_API_BASE_PATH
  );
  if (explicit !== DEFAULT_CHAN_API_BASE_PATH) {
    return explicit;
  }

  const legacy = process.env.NEXT_PUBLIC_API_BASE_URL;
  return legacy ? trimTrailingSlash(legacy) : explicit;
};

const buildUrl = (base: string, path: string) =>
  `${trimTrailingSlash(base)}${path.startsWith("/") ? path : `/${path}`}`;

const buildQueryPath = (path: string, query?: object) => {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const queryString = params.toString();
  return queryString ? `${path}?${queryString}` : path;
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasOwn = (value: Record<string, unknown>, field: string) =>
  Object.prototype.hasOwnProperty.call(value, field);

const isSuccessfulHttpStatus = (status: number) =>
  Number.isInteger(status) && status >= 200 && status < 300;

const requireString = (
  value: unknown,
  field: string,
  httpStatus: number,
  requestId: string | undefined
): string => {
  if (typeof value !== "string" || value.length === 0) {
    throw new MistApiContractError(
      `Envelope field "${field}" must be a non-empty string`,
      { httpStatus, requestId }
    );
  }
  return value;
};

const parseEnvelopeErrors = (
  value: unknown,
  httpStatus: number,
  requestId: string
): ApiEnvelopeErrors => {
  if (!isObject(value)) {
    throw new MistApiContractError(
      'Envelope field "errors" must be an object of string arrays',
      { httpStatus, requestId }
    );
  }

  for (const messages of Object.values(value)) {
    if (
      !Array.isArray(messages) ||
      !messages.every((message) => typeof message === "string")
    ) {
      throw new MistApiContractError(
        'Envelope field "errors" must be an object of string arrays',
        { httpStatus, requestId }
      );
    }
  }

  return value as ApiEnvelopeErrors;
};

/**
 * Strictly parse a non-204 JSON body against the unified backend HTTP envelope.
 *
 * Validates every required known field and the success/error branch, asserts
 * that body `statusCode` equals the real HTTP status, and rejects bare
 * payloads, malformed envelopes and status mismatches with
 * `MistApiContractError`. Additive unknown fields are tolerated for forward
 * compatibility, but a known field with the wrong type still fails closed.
 *
 * A valid success branch returns its typed `data`; a valid error branch
 * (HTTP-200 business rejection or a real non-2xx technical failure) throws
 * `MistApiError`.
 */
export function parseEnvelope<T>(
  body: unknown,
  httpStatus: number,
  requestId: string | undefined
): T {
  if (!isObject(body)) {
    throw new MistApiContractError(
      "Response body is not a JSON object envelope",
      { httpStatus, requestId }
    );
  }

  const success = body.success;
  if (success !== true && success !== false) {
    throw new MistApiContractError(
      'Envelope field "success" must be a boolean',
      { httpStatus, requestId }
    );
  }

  const bodyStatus = body.statusCode;
  if (typeof bodyStatus !== "number" || !Number.isInteger(bodyStatus)) {
    throw new MistApiContractError(
      'Envelope field "statusCode" must be an integer',
      { httpStatus, requestId }
    );
  }
  if (bodyStatus !== httpStatus) {
    throw new MistApiContractError(
      `Envelope statusCode ${bodyStatus} does not match HTTP status ${httpStatus}`,
      { httpStatus, requestId }
    );
  }

  const message = requireString(body.message, "message", httpStatus, requestId);
  const envelopeRequestId = requireString(
    body.requestId,
    "requestId",
    httpStatus,
    requestId
  );
  requireString(body.timestamp, "timestamp", httpStatus, requestId);
  requireString(body.path, "path", httpStatus, requestId);

  const successfulHttpStatus = isSuccessfulHttpStatus(httpStatus);
  if (success && !successfulHttpStatus) {
    throw new MistApiContractError(
      `A non-2xx HTTP response cannot declare success=true (HTTP ${httpStatus})`,
      { httpStatus, requestId: envelopeRequestId }
    );
  }
  if (!success && successfulHttpStatus && httpStatus !== 200) {
    throw new MistApiContractError(
      `Only HTTP 200 may carry an expected business rejection (HTTP ${httpStatus})`,
      { httpStatus, requestId: envelopeRequestId }
    );
  }

  if (success) {
    if (!hasOwn(body, "data")) {
      throw new MistApiContractError(
        'Success envelope is missing the "data" field',
        { httpStatus, requestId: envelopeRequestId }
      );
    }
    return body.data as T;
  }

  const code = requireString(body.code, "code", httpStatus, requestId);
  const rawErrors = body.errors;
  let errors: ApiEnvelopeErrors | undefined;
  if (rawErrors !== undefined) {
    if (httpStatus !== 400 || code !== "VALIDATION_ERROR") {
      throw new MistApiContractError(
        'Envelope field "errors" is only valid for HTTP 400 VALIDATION_ERROR',
        { httpStatus, requestId: envelopeRequestId }
      );
    }
    errors = parseEnvelopeErrors(rawErrors, httpStatus, envelopeRequestId);
  }

  throw new MistApiError<unknown>({
    code,
    message,
    httpStatus,
    requestId: envelopeRequestId,
    data: body.data,
    errors,
  });
}

async function readRequestId(response: Response): Promise<string | undefined> {
  const header = response.headers.get(REQUEST_ID_HEADER);
  return header === null ? undefined : header;
}

async function requestJson<T>(
  base: string,
  path: string,
  init: RequestInit
): Promise<T> {
  const response = await fetch(buildUrl(base, path), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    signal: AbortSignal.timeout(TIMEOUT),
  });

  if (response.status === 204) {
    throw new MistApiContractError(
      "Received 204 No Content for a data-returning request",
      { httpStatus: 204, requestId: await readRequestId(response) }
    );
  }

  const requestId = await readRequestId(response);
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new MistApiContractError(
      `Response body is not valid JSON (HTTP ${response.status})`,
      { httpStatus: response.status, requestId }
    );
  }

  return parseEnvelope<T>(body, response.status, requestId);
}

/**
 * Perform a request that is declared to return no content. Only an HTTP 204
 * with an empty body is accepted; it never attempts to parse JSON. The
 * server-generated `X-Request-Id` response header (if present) is returned for
 * diagnostics. Any other status fails closed.
 */
export async function requestNoContent(
  base: string,
  path: string,
  init: RequestInit
): Promise<{ requestId: string | undefined }> {
  const response = await fetch(buildUrl(base, path), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    signal: AbortSignal.timeout(TIMEOUT),
  });

  const requestId = await readRequestId(response);

  if (response.status !== 204) {
    throw new MistApiContractError(
      `Expected HTTP 204 No Content but received status ${response.status}`,
      { httpStatus: response.status, requestId }
    );
  }

  return { requestId };
}

export const fetchSecurities = () =>
  requestJson<SecurityOption[]>(getMistApiBase(), "/v1/securities", {
    method: "GET",
  });

// --- Realtime subscription client (bounded, contract-driven) ---

/**
 * List bounded realtime routing assignments. Cursor is `assignmentId ASC`;
 * pass `afterId` from the previous page's `nextAfterId` to fetch the next
 * bounded page. The response carries pagination-independent `sourceCapacities`.
 */
export const listRealtimeSubscriptions = (query?: RealtimeSubscriptionQuery) =>
  requestJson<RealtimeSubscriptionPageVo>(
    getMistApiBase(),
    buildQueryPath("/v1/realtime-subscriptions", query),
    { method: "GET" }
  );

/**
 * Initialize one immutable realtime routing assignment. Submits the frozen
 * discriminated-union payload (`mode=new|existing`). Expected business
 * rejections (HTTP 200, success=false) throw `MistApiError` carrying the stable
 * `code` and typed `data`.
 */
export const initializeRealtimeSubscription = (
  dto: InitializeRealtimeSubscriptionDto
) =>
  requestJson<RealtimeSubscriptionVo>(
    getMistApiBase(),
    "/v1/realtime-subscriptions",
    { method: "POST", body: JSON.stringify(dto) }
  );

/**
 * Existing one-Security source lookup. Fetches source configs for exactly one
 * canonical Security code; never enumerates all securities or issues per-row
 * N+1 lookups. `formatCode` is the authoritative provider symbol (read-only).
 */
export const lookupSecuritySources = (code: string) =>
  requestJson<SecuritySourceVo[]>(
    getMistApiBase(),
    `/v1/securities/${encodeURIComponent(code)}/sources`,
    { method: "GET" }
  );

/**
 * Activate a Security's realtime desired state. Success is the existing PUT
 * contract: HTTP 200 shared envelope with `data=null`. Uses the data-returning
 * envelope parser (NOT the 204-only helper); returns `null` on success.
 */
export const activateSecurity = (code: string) =>
  requestJson<null>(
    getMistApiBase(),
    `/v1/securities/${encodeURIComponent(code)}/activate`,
    { method: "PUT" }
  );

/**
 * Deactivate a Security's realtime desired state. Provider removal is deferred
 * (waits for ready/reconnect or weekday 09:15 reset); this PUT only persists
 * desired=false. Success is HTTP 200 shared envelope with `data=null`.
 */
export const deactivateSecurity = (code: string) =>
  requestJson<null>(
    getMistApiBase(),
    `/v1/securities/${encodeURIComponent(code)}/deactivate`,
    { method: "PUT" }
  );

export const collectKLines = (query: KLineQuery) =>
  requestJson<CollectKLinesResult>(getMistApiBase(), "/v1/collector/collect", {
    method: "POST",
    body: JSON.stringify(query),
  });

export const listStrategies = () =>
  requestJson<StrategyDefinition[]>(getMistApiBase(), "/v1/strategies", {
    method: "GET",
  });

export const createStrategyDefinition = (payload: StrategyDefinitionPayload) =>
  requestJson<StrategyDefinition>(getMistApiBase(), "/v1/strategies", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const enableStrategyDefinition = (id: number) =>
  requestJson<StrategyDefinition>(
    getMistApiBase(),
    `/v1/strategies/${id}/enable`,
    { method: "POST" }
  );

export const disableStrategyDefinition = (id: number) =>
  requestJson<StrategyDefinition>(
    getMistApiBase(),
    `/v1/strategies/${id}/disable`,
    { method: "POST" }
  );

export const listStrategyVersions = (id: number) =>
  requestJson<StrategyVersion[]>(
    getMistApiBase(),
    `/v1/strategies/${id}/versions`,
    { method: "GET" }
  );

export const fetchStrategySignals = (query?: StrategySignalQuery) =>
  requestJson<StrategySignal[]>(
    getMistApiBase(),
    buildQueryPath("/v1/strategy-signals", query),
    { method: "GET" }
  );

export const fetchStrategyAlertEvents = (query?: StrategyAlertEventQuery) =>
  requestJson<StrategyAlertEvent[]>(
    getMistApiBase(),
    buildQueryPath("/v1/strategy-alert-events", query),
    { method: "GET" }
  );

export const acknowledgeStrategyAlertEvent = (id: number) =>
  requestJson<StrategyAlertEvent>(
    getMistApiBase(),
    `/v1/strategy-alert-events/${id}/ack`,
    { method: "POST" }
  );

export interface ListStrategyBacktestRunsQuery {
  strategyDefinitionId?: number;
  limit?: number;
}

export const listStrategyBacktestRuns = (query?: ListStrategyBacktestRunsQuery) => {
  const params: Record<string, string> = {};
  if (query?.strategyDefinitionId) params.strategyDefinitionId = String(query.strategyDefinitionId);
  if (query?.limit) params.limit = String(query.limit);
  const search = new URLSearchParams(params).toString();
  return requestJson<StrategyBacktestRun[]>(
    getMistApiBase(),
    `/v1/strategy-backtests${search ? `?${search}` : ""}`,
    { method: "GET" }
  );
};

export const fetchStrategyBacktestRuns = listStrategyBacktestRuns;
export const fetchStrategyDefinitions = listStrategies;
export const fetchStrategyVersions = listStrategyVersions;


export const createStrategyBacktest = (payload: StrategyBacktestRequest) =>
  requestJson<BacktestRunReceipt>(
    getMistApiBase(),
    "/v1/strategy-backtests",
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );


export const fetchStrategyBacktestRun = (runId: number) =>
  requestJson<StrategyBacktestRun>(
    getMistApiBase(),
    `/v1/strategy-backtests/${runId}`,
    { method: "GET" }
  );

export const fetchStrategyBacktestSignals = async (
  runId: number
): Promise<StrategyBacktestSignalResult[]> => {
  const result = await requestJson<
    BacktestSignalPageVo | StrategyBacktestSignalResult[]
  >(getMistApiBase(), `/v1/strategy-backtests/${runId}/signals`, {
    method: "GET",
  });
  if (Array.isArray(result)) {
    return result;
  }
  if (result && Array.isArray(result.items)) {
    return result.items;
  }
  return [];
};

export const fetchK = (query: KLineQuery) =>
  requestJson<IFetchK[]>(getMistApiBase(), "/v1/indicators/k", {
    method: "POST",
    body: JSON.stringify(query),
  });

export const fetchMergeK = (query: KLineQuery) =>
  requestJson<IMergeK[]>(getAnalysisApiBase(), "/v1/chan/merge-k", {
    method: "POST",
    body: JSON.stringify(query),
  });

export function normalizeBiPhases(value: unknown): IFetchBiPhases {
  if (Array.isArray(value)) {
    return { phaseA: value, phaseB: value } as IFetchBiPhases;
  }
  if (
    value &&
    typeof value === "object" &&
    Array.isArray((value as { phaseA?: unknown }).phaseA) &&
    Array.isArray((value as { phaseB?: unknown }).phaseB)
  ) {
    const { phaseA, phaseB } = value as IFetchBiPhases;
    return { phaseA, phaseB };
  }
  throw new Error(
    "bi response must be an array or contain phaseA and phaseB arrays"
  );
}

export const fetchBi = async (query: KLineQuery) =>
  normalizeBiPhases(
    await requestJson<unknown>(getAnalysisApiBase(), "/v1/chan/bi", {
      method: "POST",
      body: JSON.stringify(query),
    })
  );

export const fetchFenxing = (query: KLineQuery) =>
  requestJson<IFenxing[]>(getAnalysisApiBase(), "/v1/chan/fenxing", {
    method: "POST",
    body: JSON.stringify(query),
  });

export function normalizeChannelPhases(value: unknown): IFetchChannelPhases {
  if (Array.isArray(value)) {
    return { phaseA: value, phaseB: value } as IFetchChannelPhases;
  }
  if (
    value &&
    typeof value === "object" &&
    Array.isArray((value as { phaseA?: unknown }).phaseA) &&
    Array.isArray((value as { phaseB?: unknown }).phaseB)
  ) {
    const { phaseA, phaseB } = value as IFetchChannelPhases;
    return { phaseA, phaseB };
  }
  throw new Error(
    "channel response must be an array or contain phaseA and phaseB arrays"
  );
}

export const fetchChannel = async (query: KLineQuery) =>
  normalizeChannelPhases(
    await requestJson<unknown>(
      getAnalysisApiBase(),
      "/v1/chan/channel",
      {
        method: "POST",
        body: JSON.stringify(query),
      }
    )
  );

export const fetchDuan = (query: KLineQuery) =>
  requestJson<IFetchDuan[]>(getAnalysisApiBase(), "/v1/chan/duan", {
    method: "POST",
    body: JSON.stringify(query),
  });

export function normalizeDuanChannelPhases(
  value: unknown
): IFetchDuanChannelPhases {
  if (Array.isArray(value)) {
    return { phaseA: value, phaseB: value } as IFetchDuanChannelPhases;
  }
  if (
    value &&
    typeof value === "object" &&
    Array.isArray((value as { phaseA?: unknown }).phaseA) &&
    Array.isArray((value as { phaseB?: unknown }).phaseB)
  ) {
    const { phaseA, phaseB } = value as IFetchDuanChannelPhases;
    return { phaseA, phaseB };
  }
  throw new Error(
    "duan-channel response must be an array or contain phaseA and phaseB arrays"
  );
}

export const fetchDuanChannel = async (query: KLineQuery) =>
  normalizeDuanChannelPhases(
    await requestJson<unknown>(
      getAnalysisApiBase(),
      "/v1/chan/duan-channel",
      {
        method: "POST",
        body: JSON.stringify(query),
      }
    )
  );

export interface VisualCommandVo {
  id: string;
  type: "line" | "band" | "text" | "icon";
  layer: string;
  startIndex?: number;
  endIndex?: number;
  fromIndex?: number;
  toIndex?: number;
  startTime?: string;
  endTime?: string;
  fromTime?: string;
  toTime?: string;
  startPrice?: number;
  endPrice?: number;
  top?: number;
  bottom?: number;
  gg?: number;
  dd?: number;
  index?: number;
  time?: string;
  price?: number;
  text?: string;
  color?: string;
  width?: number;
  style?: "solid" | "dashed" | "dotted";
  fill?: boolean;
  position?: "above" | "below" | "center";
}

export interface VisualCommandPayloadVo {
  code: string;
  period: number;
  source: string;
  totalKlines: number;
  commands: VisualCommandVo[];
}

export interface VisualCommandQuery {
  code: string;
  period: number;
  source?: DataSourceValue;
  layers?: string;
  count?: number;
  startDate?: string;
  endDate?: string;
  macroPeriod?: number;
}

export const fetchVisualCommands = (query: VisualCommandQuery) => {
  const params: Record<string, string> = {
    code: query.code,
    period: String(query.period),
  };
  if (query.source) params.source = query.source;
  if (query.layers) params.layers = query.layers;
  if (query.count) params.count = String(query.count);
  if (query.startDate) params.startDate = query.startDate;
  if (query.endDate) params.endDate = query.endDate;
  if (query.macroPeriod) params.macroPeriod = String(query.macroPeriod);

  return requestJson<VisualCommandPayloadVo>(
    getMistApiBase(),
    `/v1/visual/commands?${new URLSearchParams(params).toString()}`,
    { method: "GET" }
  );
};
