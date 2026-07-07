import type {
  IFenxing,
  IFetchBi,
  IFetchChannel,
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

export interface StrategyDefinitionPayload {
  name: string;
  description?: string;
  targetUniverse: string[];
  periods: number[];
  sources: DataSourceValue[];
  rule: Record<string, unknown>;
}

export type StrategyDefinitionUpdate = Partial<StrategyDefinitionPayload>;

export interface StrategyDefinition {
  id: number;
  name: string;
  description?: string | null;
  status: StrategyStatus;
  targetUniverse: string[];
  periods: number[];
  sources: DataSourceValue[];
  currentVersionId?: number | null;
  createTime?: string;
  updateTime?: string;
}

export interface StrategyVersion {
  id: number;
  strategyDefinitionId: number;
  versionNumber: number;
  ruleSchemaVersion: string;
  rule: Record<string, unknown>;
  validationSummary?: Record<string, unknown>;
  createTime?: string;
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
  contextSnapshot?: Record<string, unknown> | null;
  ruleSnapshot?: Record<string, unknown> | null;
  createTime?: string;
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
  createTime?: string;
  updateTime?: string;
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
  createTime?: string;
  updateTime?: string;
}

export interface StrategyBacktestSignalResult {
  id: number;
  backtestRunId: number;
  strategyDefinitionId: number;
  strategyVersionId: number;
  securityCode: string;
  period: number;
  source: DataSourceValue;
  signalTime: string;
  contextSnapshot?: Record<string, unknown> | null;
  ruleSnapshot?: Record<string, unknown> | null;
  createTime?: string;
}

interface MistEnvelope<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: { message?: string };
}

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

const isEnvelope = <T>(payload: unknown): payload is MistEnvelope<T> =>
  typeof payload === "object" &&
  payload !== null &&
  "success" in payload &&
  typeof (payload as { success?: unknown }).success === "boolean";

export function unwrapApiResponse<T>(payload: unknown): T {
  if (!isEnvelope<T>(payload)) {
    return payload as T;
  }

  if (!payload.success) {
    throw new Error(
      payload.message || payload.error?.message || "Mist API request failed"
    );
  }

  return payload.data as T;
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

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    if (payload) {
      return unwrapApiResponse<T>(payload);
    }
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return unwrapApiResponse<T>(payload);
}

export const fetchSecurities = () =>
  requestJson<SecurityOption[]>(getMistApiBase(), "/security/v1/all", {
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

export const updateStrategyDefinition = (
  id: number,
  payload: StrategyDefinitionUpdate
) =>
  requestJson<StrategyDefinition>(getMistApiBase(), `/v1/strategies/${id}`, {
    method: "PATCH",
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
  requestJson<IFetchK[]>(getAnalysisApiBase(), "/indicator/k", {
    method: "POST",
    body: JSON.stringify(query),
  });

export const fetchMergeK = (query: KLineQuery) =>
  requestJson<IMergeK[]>(getAnalysisApiBase(), "/chan/merge-k", {
    method: "POST",
    body: JSON.stringify(query),
  });

export const fetchBi = (query: KLineQuery) =>
  requestJson<IFetchBi[]>(getAnalysisApiBase(), "/chan/bi", {
    method: "POST",
    body: JSON.stringify(query),
  });

export const fetchFenxing = (query: KLineQuery) =>
  requestJson<IFenxing[]>(getAnalysisApiBase(), "/chan/fenxing", {
    method: "POST",
    body: JSON.stringify(query),
  });

export const fetchChannel = (query: KLineQuery) =>
  requestJson<IFetchChannel[]>(
    getAnalysisApiBase(),
    "/chan/channel",
    {
      method: "POST",
      body: JSON.stringify(query),
    }
  );
