/**
 * Shared JSON API helper for pages.
 *
 * Same conventions as client/src/lib/auth.tsx: cookies are httpOnly, so
 * every request uses credentials: "include"; server errors arrive as
 * { error: "<message>" } and are surfaced as-is.
 */

function readError(body: unknown, status: number): string {
  if (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof (body as { error: unknown }).error === "string"
  ) {
    return (body as { error: string }).error;
  }
  return `Request failed (HTTP ${status}).`;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok) {
    throw new Error(readError(body, res.status));
  }
  return body as T;
}

export const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "ur", label: "Urdu" },
  { value: "roman-ur", label: "Roman Urdu" },
] as const;

export function languageLabel(value: string): string {
  return (
    LANGUAGE_OPTIONS.find((o) => o.value === value)?.label ?? value
  );
}

export const STATUS_LABELS: Record<string, string> = {
  created: "Not started",
  asking: "Starting…",
  awaiting_answer: "In progress",
  evaluating: "Evaluating…",
  completed: "Completed",
  paused: "Paused",
  interrupted: "Interrupted",
  failed: "Failed",
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}
