const KEY = "witz.byok";

export type Byok = { apiKey: string; model: string; baseUrl?: string };

export function loadByok(): Byok | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Byok;
    return parsed.apiKey && parsed.model ? parsed : null;
  } catch {
    return null;
  }
}

export function saveByok(value: Byok | null) {
  if (typeof window === "undefined") return;
  if (!value) localStorage.removeItem(KEY);
  else localStorage.setItem(KEY, JSON.stringify(value));
}
