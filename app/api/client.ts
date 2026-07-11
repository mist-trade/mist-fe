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

export type DataSourceValue = "ef" | "tdx" | "qmt";
export type StrategyStatus = "draft" | "enabled" | "disabled" | "archived";
export type StrategyAlertStatus = "pending" | "delivered" | "acked" | "failed";
export type BacktestRunStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";
export type BacktestRunStage =
  | "queued"
  | "loading_data"
  | "simulating"
  | "finalizing";
export type StrategySignalSource = "live" | "backtest";
export type StrategySignalKind = "entry" | "exit";
export type BacktestOrderSide = "buy" | "sell";
export type BacktestOrderStatus =
  | "pending"
  | "filled"
  | "rejected"
  | "expired"
  | "cancelled";
export type BacktestTradeStatus = "open" | "closed";

export interface StrategyBacktestCursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

export interface StrategyBacktestPageQuery {
  cursor?: string;
  limit?: number;
}

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
  entryRule: Record<string, unknown>;
  exitRule?: Record<string, unknown> | null;
  lookbackBars: number;
  backtestEnabled?: boolean;
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
  backtestEnabled: boolean;
  currentVersionId?: number | null;
  createTime?: string;
  updateTime?: string;
}

export interface StrategyVersion {
  id: number;
  strategyDefinitionId: number;
  versionNumber: number;
  ruleSchemaVersion: string;
  entryRule: Record<string, unknown>;
  exitRule?: Record<string, unknown> | null;
  lookbackBars: number;
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
  signalKind: StrategySignalKind;
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
  strategyDefinitionId: number;
  strategyVersionId?: number;
  targetUniverse: string[];
  period: number;
  source: DataSourceValue;
  startDate: string;
  endDate: string;
  initialCash?: number;
  maxPositions?: number;
  slippageBps?: number;
  commissionRate?: number;
  minCommission?: number;
  stampDutyRate?: number;
  transferFeeRate?: number;
  benchmarkCode?: string;
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
  stage: BacktestRunStage;
  signalCount: number;
  matchedSecurityCount: number;
  processedWork: number;
  totalWork: number;
  progressPercent: number;
  attemptCount: number;
  strategySnapshot?: Record<string, unknown>;
  configSnapshot?: Record<string, unknown>;
  metrics?: Record<string, number | null> | null;
  errorCode?: string | null;
  errorDetails?: Record<string, unknown> | null;
  cancelRequestedAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  errorMessage?: string | null;
  createTime?: string;
  updateTime?: string;
}

export interface StrategyBacktestSignal {
  id: number;
  backtestRunId: number;
  strategyDefinitionId: number;
  strategyVersionId: number;
  securityCode: string;
  period: number;
  source: DataSourceValue;
  signalKind: StrategySignalKind;
  signalTime: string;
  contextSnapshot?: Record<string, unknown> | null;
  ruleSnapshot?: Record<string, unknown> | null;
  createTime?: string;
}

export interface StrategyBacktestOrder {
  id: number;
  backtestRunId: number;
  backtestSignalId?: number | null;
  securityCode: string;
  side: BacktestOrderSide;
  status: BacktestOrderStatus;
  reason?: string | null;
  scheduledTime: string;
  executionTime?: string | null;
  expiredAt?: string | null;
  quantity: number;
  fillPrice?: number | null;
  grossAmount?: number | null;
  commission: number;
  stampDuty: number;
  transferFee: number;
  totalFee: number;
}

export interface StrategyBacktestTrade {
  id: number;
  backtestRunId: number;
  securityCode: string;
  status: BacktestTradeStatus;
  entryOrderId: number;
  exitOrderId?: number | null;
  entryTime: string;
  exitTime?: string | null;
  entryPrice: number;
  exitPrice?: number | null;
  quantity: number;
  entryFee: number;
  exitFee: number;
  realizedPnl?: number | null;
  holdingDays?: number | null;
}

export interface StrategyBacktestEquityPoint {
  id: number;
  backtestRunId: number;
  pointTime: string;
  cash: number;
  marketValue: number;
  equity: number;
  benchmarkValue?: number | null;
  drawdown: number;
  exposure: number;
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

export const listStrategyBacktests = (
  query?: StrategyBacktestPageQuery & {
    strategyDefinitionId?: number;
    status?: BacktestRunStatus;
  }
) =>
  requestJson<StrategyBacktestCursorPage<StrategyBacktestRun>>(
    getMistApiBase(),
    buildQueryPath("/v1/strategy-backtests", query),
    { method: "GET" }
  );

export const fetchStrategyBacktestRun = (runId: number) =>
  requestJson<StrategyBacktestRun>(
    getMistApiBase(),
    `/v1/strategy-backtests/${runId}`,
    { method: "GET" }
  );

export const cancelStrategyBacktest = (runId: number) =>
  requestJson<StrategyBacktestRun>(
    getMistApiBase(),
    `/v1/strategy-backtests/${runId}/cancel`,
    { method: "POST" }
  );

export const fetchStrategyBacktestEquity = (runId: number) =>
  requestJson<StrategyBacktestEquityPoint[]>(
    getMistApiBase(),
    `/v1/strategy-backtests/${runId}/equity`,
    { method: "GET" }
  );

export const fetchStrategyBacktestSignals = (
  runId: number,
  query?: StrategyBacktestPageQuery
) =>
  requestJson<StrategyBacktestCursorPage<StrategyBacktestSignal>>(
    getMistApiBase(),
    buildQueryPath(`/v1/strategy-backtests/${runId}/signals`, query),
    { method: "GET" }
  );

export const fetchStrategyBacktestOrders = (
  runId: number,
  query?: StrategyBacktestPageQuery
) =>
  requestJson<StrategyBacktestCursorPage<StrategyBacktestOrder>>(
    getMistApiBase(),
    buildQueryPath(`/v1/strategy-backtests/${runId}/orders`, query),
    { method: "GET" }
  );

export const fetchStrategyBacktestTrades = (
  runId: number,
  query?: StrategyBacktestPageQuery
) =>
  requestJson<StrategyBacktestCursorPage<StrategyBacktestTrade>>(
    getMistApiBase(),
    buildQueryPath(`/v1/strategy-backtests/${runId}/trades`, query),
    { method: "GET" }
  );

export const fetchStrategyBacktestPositions = (
  runId: number,
  query?: StrategyBacktestPageQuery & { asOf?: string }
) =>
  requestJson<StrategyBacktestCursorPage<StrategyBacktestTrade>>(
    getMistApiBase(),
    buildQueryPath(`/v1/strategy-backtests/${runId}/positions`, query),
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
