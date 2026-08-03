import { useState } from "react";
import { X, KeyRound } from "lucide-react";
import { loadByok, saveByok } from "@/lib/byok";

export function ApiKeyDialog({ onClose }: { onClose: () => void }) {
  const existing = loadByok();
  const [apiKey, setApiKey] = useState(existing?.apiKey ?? "");
  const [model, setModel] = useState(existing?.model ?? "");
  const [baseUrl, setBaseUrl] = useState(existing?.baseUrl ?? "https://openrouter.ai/api/v1");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="glass-strong glow-ring w-full max-w-md rounded-3xl p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display flex items-center gap-2 text-lg font-bold">
            <KeyRound className="size-4 text-primary" /> Your own API key
          </h2>
          <button onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-primary">
            <X className="size-4" />
          </button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Stored only in this browser and sent straight to your provider — never saved on our servers.
          Works with any OpenAI-compatible endpoint.
        </p>

        <div className="mt-5 space-y-3">
          {[
            { label: "API key", value: apiKey, set: setApiKey, ph: "sk-…", type: "password" },
            { label: "Model id", value: model, set: setModel, ph: "openai/gpt-4o-mini", type: "text" },
            { label: "Base URL", value: baseUrl, set: setBaseUrl, ph: "https://…/v1", type: "text" },
          ].map((f) => (
            <label key={f.label} className="block">
              <span className="label-mono text-muted-foreground">{f.label}</span>
              <input
                type={f.type}
                value={f.value}
                placeholder={f.ph}
                onChange={(e) => f.set(e.target.value)}
                className="glass mt-1 w-full rounded-2xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/60"
              />
            </label>
          ))}
        </div>

        <div className="mt-6 flex items-center gap-2">
          <button
            onClick={() => {
              saveByok(apiKey && model ? { apiKey, model, baseUrl } : null);
              onClose();
            }}
            className="btn-glow flex-1 rounded-full px-5 py-2.5 text-sm font-semibold"
          >
            Save key
          </button>
          <button
            onClick={() => {
              saveByok(null);
              onClose();
            }}
            className="glass rounded-full px-5 py-2.5 text-sm text-muted-foreground hover:text-destructive"
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}
