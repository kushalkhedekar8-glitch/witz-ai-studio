import { useState } from "react";
import { X, KeyRound, Plus, Trash2, Check } from "lucide-react";
import {
  listByok,
  saveByokList,
  activeByokId,
  setActiveByok,
  type ByokEntry,
} from "@/lib/byok";

export function ApiKeyDialog({ onClose }: { onClose: () => void }) {
  const [entries, setEntries] = useState<ByokEntry[]>(() => listByok());
  const [active, setActive] = useState<string | null>(() => activeByokId());
  const [label, setLabel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [baseUrl, setBaseUrl] = useState("https://openrouter.ai/api/v1");
  const [error, setError] = useState<string | null>(null);

  const commit = (next: ByokEntry[], activeId: string | null) => {
    setEntries(next);
    setActive(activeId);
    saveByokList(next, activeId);
  };

  const add = () => {
    if (apiKey.trim().length < 8 || !model.trim()) {
      setError("Add both an API key and a model name.");
      return;
    }
    setError(null);
    const entry: ByokEntry = {
      id: crypto.randomUUID(),
      label: label.trim() || "My API",
      apiKey: apiKey.trim(),
      model: model.trim(),
      ...(baseUrl.trim() ? { baseUrl: baseUrl.trim() } : {}),
    };
    commit([...entries, entry], entry.id);
    setLabel("");
    setApiKey("");
    setModel("");
  };

  const field =
    "glass w-full rounded-2xl px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-primary";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="glass-strong glow-ring max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display flex items-center gap-2 text-lg font-bold">
            <KeyRound className="size-4 text-primary" /> Your API keys
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-muted-foreground hover:text-primary"
          >
            <X className="size-4" />
          </button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Add as many APIs as you like — any OpenAI-compatible endpoint works. They stay in this
          browser only and power the “Your Key” engine.
        </p>

        {entries.length > 0 && (
          <div className="mt-4 space-y-2">
            {entries.map((e) => (
              <div key={e.id} className="glass flex items-center gap-2 rounded-2xl px-3 py-2.5">
                <button
                  onClick={() => {
                    setActive(e.id);
                    setActiveByok(e.id);
                  }}
                  className={`flex min-w-0 flex-1 items-center gap-2 text-left text-xs ${
                    e.id === active ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {e.id === active ? <Check className="size-3.5 shrink-0" /> : <span className="size-3.5" />}
                  <span className="truncate">
                    {e.label} · {e.model}
                  </span>
                </button>
                <button
                  aria-label={`Remove ${e.label}`}
                  onClick={() => {
                    const next = entries.filter((x) => x.id !== e.id);
                    commit(next, next.some((x) => x.id === active) ? active : (next[0]?.id ?? null));
                  }}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 space-y-3">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Name (e.g. My router key)"
            className={field}
          />
          <input
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            type="password"
            placeholder="API key"
            className={field}
          />
          <input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="Model id (e.g. gpt-4o-mini)"
            className={field}
          />
          <input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="Base URL"
            className={field}
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <button onClick={add} className="btn-glow w-full rounded-full px-4 py-2.5 text-sm">
            <Plus className="size-4" /> Add this API
          </button>
        </div>
      </div>
    </div>
  );
}
