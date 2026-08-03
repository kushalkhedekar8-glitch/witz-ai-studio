import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  Copy,
  Layers,
  LifeBuoy,
  LogOut,
  Plus,
  Sparkles,
  Star,
  Home as HomeIcon,
  Settings,
  Loader2,
} from "lucide-react";
import { STUDIO_MODELS, DEFAULT_MODEL } from "@/lib/models";
import { runStudio } from "@/lib/studio.functions";
import { extractArtifact } from "@/lib/artifact";
import { ArtifactPanel } from "@/components/ArtifactPanel";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Witz AI Studio — Build with multiple AI engines" },
      {
        name: "description",
        content:
          "Witz AI Studio is a liquid-glass workspace where you prompt multiple AI engines to draft, reason and generate production-ready code.",
      },
      { property: "og:title", content: "Witz AI Studio — Build with multiple AI engines" },
      {
        property: "og:description",
        content:
          "A minimal, futuristic studio for prompting multiple AI engines and generating production-ready code.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Studio,
});

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Glass login page",
  "SaaS pricing table",
  "Interactive map UI",
  "Crypto bento grid",
];

function Studio() {
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [error, setError] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const call = useServerFn(runStudio);

  const mutation = useMutation({
    mutationFn: async (history: Msg[]) => call({ data: { model, messages: history } }),
    onSuccess: (res) =>
      setMessages((m) => [...m, { role: "assistant", content: res.text || "(no output)" }]),
    onError: (e: Error) => setError(e.message),
  });

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages, mutation.isPending]);

  const send = (text: string) => {
    const value = text.trim();
    if (!value || mutation.isPending) return;
    setError(null);
    const next: Msg[] = [...messages, { role: "user", content: value }];
    setMessages(next);
    setInput("");
    mutation.mutate(next);
  };

  const active = STUDIO_MODELS.find((m) => m.id === model)!;

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const artifact = lastAssistant ? extractArtifact(lastAssistant.content) : null;

  return (
    <div className="flex min-h-screen gap-4 p-4 md:gap-4 md:p-5">
      {/* Sidebar */}
      <aside className="glass hidden w-64 shrink-0 flex-col rounded-3xl p-4 lg:flex">
        <div className="px-2 py-3">
          <span className="font-display text-xl font-bold text-gradient">Witz AI Studio</span>
        </div>
        <button
          onClick={() => {
            setMessages([]);
            setError(null);
          }}
          className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-brand px-4 py-3 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.02]"
        >
          <Plus className="size-4" /> New session
        </button>
        <nav className="mt-6 space-y-1">
          {[
            { icon: HomeIcon, label: "Home", active: true },
            { icon: Star, label: "Saved projects" },
            { icon: Layers, label: "Templates" },
          ].map((item) => (
            <div
              key={item.label}
              className={`flex cursor-default items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition-colors ${
                item.active
                  ? "bg-glass-strong text-primary"
                  : "text-muted-foreground hover:bg-glass hover:text-foreground"
              }`}
            >
              <item.icon className="size-4" />
              {item.label}
            </div>
          ))}
        </nav>
        <div className="mt-auto space-y-1 pt-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-3 rounded-2xl px-3 py-2.5">
            <LifeBuoy className="size-4" /> Help
          </div>
          <div className="flex items-center gap-3 rounded-2xl px-3 py-2.5">
            <LogOut className="size-4" /> Logout
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex min-w-0 flex-1 flex-col gap-4">
        <header className="glass flex items-center justify-between gap-4 rounded-3xl px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="font-display text-base font-bold text-gradient lg:hidden">Witz</span>
            <div className="glass-strong hidden items-center gap-2 rounded-full px-4 py-2 sm:flex">
              <Sparkles className="size-4 text-primary" />
              <div className="leading-tight">
                <p className="label-mono text-muted-foreground">Engine</p>
                <p className="text-sm font-medium">{active.name}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="label-mono hidden text-muted-foreground sm:inline">
              {active.badge}
            </span>
            <Settings className="size-4 text-muted-foreground" />
          </div>
        </header>

        {/* Engine picker */}
        <div className="flex gap-3 overflow-x-auto pb-1">
          {STUDIO_MODELS.map((m) => {
            const on = m.id === model;
            return (
              <button
                key={m.id}
                onClick={() => setModel(m.id)}
                className={`min-w-[190px] flex-1 rounded-3xl p-4 text-left transition-all ${
                  on
                    ? "glass-strong ring-1 ring-primary/60"
                    : "glass hover:bg-glass-strong opacity-80 hover:opacity-100"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-display text-base font-semibold">{m.name}</span>
                  <span className="label-mono rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                    {m.badge}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{m.tagline}</p>
              </button>
            );
          })}
        </div>

        {/* Conversation */}
        <section className="glass flex min-h-0 flex-1 flex-col rounded-3xl p-4 md:p-6">
          <div ref={scroller} className="min-h-[38vh] flex-1 space-y-4 overflow-y-auto pr-1">
            {messages.length === 0 && !mutation.isPending && (
              <div className="flex h-full flex-col items-center justify-center py-10 text-center">
                <h1 className="max-w-xl text-3xl font-bold text-gradient md:text-5xl">
                  What are we building today?
                </h1>
                <p className="mt-3 max-w-md text-sm text-muted-foreground md:text-base">
                  Describe your vision and watch the studio bring it to life.
                </p>
                <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
                  <span className="label-mono text-muted-foreground">Suggested</span>
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="glass rounded-full px-4 py-2 text-xs text-muted-foreground transition-colors hover:text-primary"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`group relative max-w-[90%] rounded-3xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap md:max-w-[80%] ${
                    m.role === "user"
                      ? "bg-gradient-brand text-primary-foreground font-medium"
                      : "glass-strong font-mono text-[0.83rem]"
                  }`}
                >
                  {m.content}
                  {m.role === "assistant" && (
                    <button
                      onClick={() => navigator.clipboard.writeText(m.content)}
                      aria-label="Copy response"
                      className="absolute -top-2 -right-2 rounded-full bg-card p-1.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-primary"
                    >
                      <Copy className="size-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}

            {mutation.isPending && (
              <div className="glass-strong inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs text-primary">
                <Loader2 className="size-3.5 animate-spin" />
                <span className="label-mono animate-witz-pulse">{active.name} thinking</span>
              </div>
            )}

            {error && (
              <p className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-xs text-destructive-foreground">
                {error}
              </p>
            )}
          </div>

          {artifact && <ArtifactPanel artifact={artifact} />}



          {/* Composer */}
          <div className="glass-strong mt-4 rounded-3xl p-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              rows={3}
              placeholder="I want to create a responsive bento grid for a crypto dashboard…"
              className="w-full resize-none bg-transparent px-2 py-1 text-sm outline-none placeholder:text-muted-foreground"
            />
            <div className="mt-2 flex items-center justify-between gap-3 border-t border-border pt-3">
              <span className="label-mono text-muted-foreground">
                {active.name} · ready
              </span>
              <button
                onClick={() => send(input)}
                disabled={mutation.isPending || !input.trim()}
                className="inline-flex items-center gap-2 rounded-full bg-gradient-brand px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.03] disabled:opacity-40 disabled:hover:scale-100"
              >
                Generate <ArrowUp className="size-4" />
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
