const DEFAULT_MIST_API_BASE_PATH = "/api/mist";
const DEFAULT_CHAN_API_BASE_PATH = "/api/chan";

const TIMEOUT = Number.parseInt(
  process.env.NEXT_PUBLIC_API_TIMEOUT || "10000",
  10
);

export type DataSourceValue = "ef" | "tdx" | "mqmt";

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
      try {
        return unwrapApiResponse<T>(payload);
      } catch (error) {
        throw error;
      }
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

export const fetchK = (query: KLineQuery) =>
  requestJson<import("./fetch").IFetchK[]>(getAnalysisApiBase(), "/indicator/k", {
    method: "POST",
    body: JSON.stringify(query),
  });

export const fetchMergeK = (query: KLineQuery) =>
  requestJson<import("./fetch").IMergeK[]>(getAnalysisApiBase(), "/chan/merge-k", {
    method: "POST",
    body: JSON.stringify(query),
  });

export const fetchBi = (query: KLineQuery) =>
  requestJson<import("./fetch").IFetchBi[]>(getAnalysisApiBase(), "/chan/bi", {
    method: "POST",
    body: JSON.stringify(query),
  });

export const fetchFenxing = (query: KLineQuery) =>
  requestJson<import("./fetch").IFenxing[]>(getAnalysisApiBase(), "/chan/fenxing", {
    method: "POST",
    body: JSON.stringify(query),
  });

export const fetchChannel = (query: KLineQuery) =>
  requestJson<import("./fetch").IFetchChannel[]>(
    getAnalysisApiBase(),
    "/chan/channel",
    {
      method: "POST",
      body: JSON.stringify(query),
    }
  );
