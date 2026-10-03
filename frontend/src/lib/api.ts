const pending = new Map<string, Promise<unknown>>();
const baseUrl = "http://127.0.0.1:8000";

export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

async function request<T>(path: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`);
  } catch {
    throw new Error("サーバーに接続できませんでした。接続状況を確認してください。");
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    if (typeof body?.detail === "string") throw new Error(body.detail);
    throw new Error(`データを取得できませんでした（HTTP ${response.status}）。時間をおいて再度お試しください。`);
  }
  try {
    return await response.json() as T;
  } catch {
    throw new Error("サーバーから正しいデータを受け取れませんでした。");
  }
}

// Share only in-flight GETs. Completed results remain managed by the backend.
// A component's cleanup must not cancel another component's shared request.
export function getJson<T>(path: string): Promise<T> {
  const existing = pending.get(path);
  if (existing) return existing as Promise<T>;
  const promise = request<T>(path).finally(() => pending.delete(path));
  pending.set(path, promise);
  return promise;
}
