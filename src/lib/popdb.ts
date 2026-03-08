const API_URL = import.meta.env.VITE_API_URL;
const AUTH_URL = import.meta.env.VITE_AUTH_URL;
const ENVIRONMENT = import.meta.env.VITE_ENVIRONMENT;

// --- Types ---

export type User = {
  id: string;
  email: string;
  role: string;
  [key: string]: unknown;
};

export type AuthResponse = {
  user: User;
  accessToken: string;
  refreshToken: string;
};

export type ApiFetchOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  query?: Record<string, string>;
  single?: boolean;
  prefer?: string;
};

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

// --- Token Management ---

const ACCESS_TOKEN_KEY = "popdb_access_token";
const REFRESH_TOKEN_KEY = "popdb_refresh_token";

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setAccessToken(token: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setRefreshToken(token: string): void {
  localStorage.setItem(REFRESH_TOKEN_KEY, token);
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

// --- Internal Helpers ---

function baseHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-popdb-environment": ENVIRONMENT,
  };
  const token = getAccessToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

let refreshPromise: Promise<boolean> | null = null;

async function attemptTokenRefresh(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      await refreshSession();
      return true;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

// --- Auth ---

export async function login(
  email: string,
  password: string
): Promise<AuthResponse> {
  const response = await fetch(`${AUTH_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status,
      (body as { message?: string }).message ?? "Login failed",
      body
    );
  }

  const data = (await response.json()) as AuthResponse;
  setAccessToken(data.accessToken);
  setRefreshToken(data.refreshToken);
  return data;
}

export async function register(
  email: string,
  password: string
): Promise<AuthResponse> {
  const response = await fetch(`${AUTH_URL}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status,
      (body as { message?: string }).message ?? "Registration failed",
      body
    );
  }

  const data = (await response.json()) as AuthResponse;
  setAccessToken(data.accessToken);
  setRefreshToken(data.refreshToken);
  return data;
}

export async function refreshSession(): Promise<AuthResponse> {
  const token = getRefreshToken();
  if (!token) {
    throw new ApiError(401, "No refresh token available");
  }

  const response = await fetch(`${AUTH_URL}/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: token }),
  });

  if (!response.ok) {
    clearTokens();
    const body = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status,
      (body as { message?: string }).message ?? "Session refresh failed",
      body
    );
  }

  const data = (await response.json()) as AuthResponse;
  setAccessToken(data.accessToken);
  setRefreshToken(data.refreshToken);
  return data;
}

export async function getMe(): Promise<User> {
  const response = await fetch(`${AUTH_URL}/me`, {
    headers: baseHeaders(),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status,
      (body as { message?: string }).message ?? "Failed to fetch user",
      body
    );
  }

  return response.json() as Promise<User>;
}

export function logout(): void {
  clearTokens();
}

// --- PostgREST Query Helpers ---

export const eq = (val: string | number | boolean) => `eq.${val}`;
export const neq = (val: string | number | boolean) => `neq.${val}`;
export const gt = (val: string | number) => `gt.${val}`;
export const gte = (val: string | number) => `gte.${val}`;
export const lt = (val: string | number) => `lt.${val}`;
export const lte = (val: string | number) => `lte.${val}`;
export const like = (val: string) => `like.${val}`;
export const ilike = (val: string) => `ilike.${val}`;
export const is = (val: boolean | null) => `is.${val}`;
export const in_ = (vals: (string | number)[]) => `in.(${vals.join(",")})`;

// --- REST API ---

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const { method = "GET", headers = {}, body, query, single, prefer } = options;

  let url = `${API_URL}/${path}`;
  if (query && Object.keys(query).length > 0) {
    url += `?${new URLSearchParams(query).toString()}`;
  }

  const mergedHeaders: Record<string, string> = {
    ...baseHeaders(),
    ...headers,
  };

  if (single) {
    mergedHeaders["Accept"] = "application/vnd.pgrst.object+json";
  }

  if (prefer) {
    mergedHeaders["Prefer"] = prefer;
  }

  const init: RequestInit = {
    method,
    headers: mergedHeaders,
  };

  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }

  let response = await fetch(url, init);

  if (response.status === 401) {
    const refreshed = await attemptTokenRefresh();
    if (refreshed) {
      mergedHeaders["Authorization"] = `Bearer ${getAccessToken()}`;
      response = await fetch(url, { ...init, headers: mergedHeaders });
    }
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status,
      (errorBody as { message?: string }).message ?? `Request failed: ${path}`,
      errorBody
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
