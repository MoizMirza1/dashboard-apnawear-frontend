function getBaseApiUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api").trim().replace(/\/+$/, "");
  return raw.endsWith("/api") ? raw : `${raw}/api`;
}

const API_URL = getBaseApiUrl();

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const response = await fetch(`${API_URL}${normalizedPath}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const payload = (await response.json().catch(() => null)) as
    | { message?: string; details?: unknown }
    | null;

  if (!response.ok) {
    throw new ApiClientError(
      payload?.message ?? "The server request failed.",
      response.status,
      payload?.details,
    );
  }

  return payload as T;
}
