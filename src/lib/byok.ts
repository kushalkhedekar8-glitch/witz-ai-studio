const KEY = "witz.byok";
const LIST = "witz.byok.list";
const ACTIVE = "witz.byok.active";

export type Byok = { apiKey: string; model: string; baseUrl?: string };
export type ByokEntry = Byok & { id: string; label: string };

function read<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/** Every API the user added, newest last. Migrates the old single-key format. */
export function listByok(): ByokEntry[] {
  const list = read<ByokEntry[]>(LIST);
  if (list && Array.isArray(list)) return list.filter((e) => e.apiKey && e.model);
  const legacy = read<Byok>(KEY);
  if (legacy?.apiKey && legacy.model) {
    const migrated: ByokEntry[] = [
      { id: "legacy", label: "My API", ...legacy },
    ];
    saveByokList(migrated, "legacy");
    return migrated;
  }
  return [];
}

export function saveByokList(entries: ByokEntry[], activeId?: string | null) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LIST, JSON.stringify(entries));
  const next = activeId ?? entries[0]?.id ?? null;
  if (next) localStorage.setItem(ACTIVE, next);
  else localStorage.removeItem(ACTIVE);
}

export function activeByokId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE) ?? listByok()[0]?.id ?? null;
}

export function setActiveByok(id: string | null) {
  if (typeof window === "undefined") return;
  if (id) localStorage.setItem(ACTIVE, id);
  else localStorage.removeItem(ACTIVE);
}

/** The key the studio should use for the "Your Key" engine. */
export function loadByok(): Byok | null {
  const entries = listByok();
  if (entries.length === 0) return null;
  const id = activeByokId();
  const found = entries.find((e) => e.id === id) ?? entries[0]!;
  const base: Byok = { apiKey: found.apiKey, model: found.model };
  return found.baseUrl ? { ...base, baseUrl: found.baseUrl } : base;
}

export function saveByok(value: Byok | null) {
  if (typeof window === "undefined") return;
  if (!value) {
    saveByokList([], null);
    localStorage.removeItem(KEY);
    return;
  }
  const entry: ByokEntry = { id: crypto.randomUUID(), label: "My API", ...value };
  saveByokList([...listByok(), entry], entry.id);
}
