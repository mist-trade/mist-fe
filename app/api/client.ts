import type {
  IFenxing,
  IFetchBiPhases,
  IFetchChannelPhases,
  IFetchK,
  IMergeK,
} from "./types";

const DEFAULT_MIST_API_BASE_PATH = "/api/mist";
const DEFAULT_CHAN_API_BASE_PATH = "/api/chan";

const TIMEOUT = Number.parseInt(
  process.env.NEXT_PUBLIC_API_TIMEOUT || "10000",
  10
);

export type DataSourceValue = "ef" | "tdx" | "mqmt";
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
  securityCode?: string;
  period?: number;
  source?: DataSourceValue;
}

export interface StrategySignal {
  id: number;
  strategyDefinitionId: number;
  strategyVersionId: number;
  securityCode: string;
  period: number;
  source: DataSourceValue;
  signalTime: string;
  signalSource: StrategySignalSource;
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

export interface StrategyScanRequest {
  strategyDefinitionId?: number;
  period?: number;
  source?: DataSourceValue;
}

export interface StrategyScanResult {
  createdSignalCount?: number;
  createdAlertCount?: number;
  skippedDuplicateCount?: number;
  [key: string]: unknown;
}

export interface StrategyBacktestRequest {
  strategyVersionId: number;
  targetUniverse: string[];
  period: number;
  source: DataSourceValue;
  startDate: string;
  endDate: string;
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

export const runStrategyScan = (payload: StrategyScanRequest = {}) =>
  requestJson<StrategyScanResult>(
    getMistApiBase(),
    "/v1/strategy-scans/run",
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );

export const createStrategyBacktest = (payload: StrategyBacktestRequest) =>
  requestJson<StrategyBacktestRun>(
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

export const fetchStrategyBacktestSignals = (runId: number) =>
  requestJson<StrategyBacktestSignalResult[]>(
    getMistApiBase(),
    `/v1/strategy-backtests/${runId}/signals`,
    { method: "GET" }
  );

export const fetchK = (query: KLineQuery) =>
  requestJson<IFetchK[]>(getAnalysisApiBase(), "/v1/indicators/k", {
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
