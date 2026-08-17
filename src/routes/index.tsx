import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  Copy,
  Cpu,
  KeyRound,
  Layers,
  LogIn,
  LogOut,
  MessageSquare,
  Paperclip,
  Plus,
  Sparkles,
  Trash2,
  X,
  Loader2,
  Users,
  Image as ImageIcon,
} from "lucide-react";
import { STUDIO_MODELS, DEFAULT_MODEL } from "@/lib/models";
import { TASK_MODELS, DEFAULT_TASK_MODELS, type TaskModelChoice } from "@/lib/tasks";
import { extractArtifact } from "@/lib/artifact";
import { ArtifactPanel } from "@/components/ArtifactPanel";
import { ProjectWorkspace } from "@/components/ProjectWorkspace";
import { runTask } from "@/lib/studio.functions";
import type { BuildResult } from "@/lib/project";

import { ApiKeyDialog } from "@/components/ApiKeyDialog";
import { loadByok } from "@/lib/byok";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  createConversation,
  deleteConversation,
  listConversations,
  loadMessages,
  saveMessage,
  type ChatMsg,
} from "@/lib/chats";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Witz AI Studio — Build with multiple AI engines" },
      {
        name: "description",
        content:
          "Witz AI Studio is a neon liquid-glass workspace: prompt multiple AI engines, attach files, preview and ship generated code, and keep every session saved.",
      },
      { property: "og:title", content: "Witz AI Studio — Build with multiple AI engines" },
      {
        property: "og:description",
        content:
          "Witz AI Studio is a neon liquid-glass workspace: prompt multiple AI engines, attach files, preview and ship generated code, and keep every session saved.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Studio,
});

const SUGGESTIONS = [
  "Glass login page",
  "SaaS pricing table",
  "Interactive map UI",
  "Crypto bento grid",
];

type Attachment = { name: string; text: string };

const MAX_ATTACHMENT_CHARS = 12000;

function Studio() {
  const { user, loading: authLoading } = useAuth();
  const qc = useQueryClient();
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [showKeys, setShowKeys] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const taskCall = useServerFn(runTask);
  const [teamMode, setTeamMode] = useState(true);
  const [withMockup, setWithMockup] = useState(true);
  const [project, setProject] = useState<BuildResult | null>(null);
  const [taskModels, setTaskModels] = useState<TaskModelChoice>(DEFAULT_TASK_MODELS);
  const [showPicker, setShowPicker] = useState(false);


  const history = useQuery({
    queryKey: ["conversations", user?.id],
    queryFn: listConversations,
    enabled: !!user,
  });

  const persist = async (msg: ChatMsg, convo: string | null) => {
    if (!user) return convo;
    let id = convo;
    if (!id) {
      id = await createConversation(user.id, msg.content || "New session", model);
      setConversationId(id);
    }
    await saveMessage(id, user.id, msg);
    qc.invalidateQueries({ queryKey: ["conversations", user.id] });
    return id;
  };

  const mutation = useMutation({
    mutationFn: async ({ history: h, convo }: { history: ChatMsg[]; convo: string | null }) => {
      const byok = model === "custom" ? (loadByok() ?? undefined) : undefined;
      if (model === "custom" && !byok) {
        throw new Error("Add your own API key first (key icon in the header).");
      }
      const res = await call({
        data: {
          model,
          byok,
          messages: h.map((m) => ({ role: m.role, content: m.content })),
        },
      });
      if (res.error) throw new Error(res.error);
      return { text: res.text || "(no output)", convo };
    },
    onSuccess: async ({ text, convo }) => {
      setMessages((m) => [...m, { role: "assistant", content: text }]);
      await persist({ role: "assistant", content: text }, convo);
    },

    onError: (e: Error) => setError(e.message),
  });

  const build = useMutation({
    mutationFn: async ({ brief, convo }: { brief: string; convo: string | null }) => {
      const byok = loadByok() ?? undefined;
      const res = await buildCall({
        data: { brief, engine: model, byok, team: teamMode, withMockup },
      });
      if (res.error) throw new Error(res.error);
      return { res, convo };
    },
    onSuccess: async ({ res, convo }) => {
      setProject(res);
      const summary =
        (res.plan ? `${res.plan}\n\n` : "") +
        `Build complete — ${res.files.length} files ready in the workspace:\n` +
        res.steps.map((s) => `• ${s.agent} — ${s.role} (${s.status})`).join("\n");
      setMessages((m) => [...m, { role: "assistant", content: summary }]);
      await persist({ role: "assistant", content: summary }, convo);
    },
    onError: (e: Error) => setError(e.message),
  });

  const busy = mutation.isPending || build.isPending;

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const send = async (text: string) => {
    const value = text.trim();
    if ((!value && attachments.length === 0) || busy) return;
    setError(null);

    const attachBlock = attachments
      .map((a) => `\n\n--- Attached file: ${a.name} ---\n${a.text}`)
      .join("");
    const userMsg: ChatMsg = {
      role: "user",
      content: value + attachBlock,
      attachments: attachments.map((a) => a.name),
    };

    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setAttachments([]);

    let convo = conversationId;
    try {
      convo = (await persist(userMsg, convo)) ?? null;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save this message.");
    }
    if (teamMode) build.mutate({ brief: userMsg.content, convo });
    else mutation.mutate({ history: next, convo });
  };

  const onFiles = async (files: FileList | null) => {
    if (!files) return;
    const picked: Attachment[] = [];
    for (const file of Array.from(files).slice(0, 4)) {
      try {
        const text = await file.text();
        picked.push({
          name: file.name,
          text: text.slice(0, MAX_ATTACHMENT_CHARS) || "(binary or empty file)",
        });
      } catch {
        picked.push({ name: file.name, text: "(unreadable file)" });
      }
    }
    setAttachments((a) => [...a, ...picked].slice(0, 4));
  };

  const openConversation = async (id: string) => {
    setError(null);
    setConversationId(id);
    try {
      setMessages(await loadMessages(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load that session.");
    }
  };

  const newSession = () => {
    setProject(null);
    setMessages([]);
    setConversationId(null);
    setAttachments([]);
    setError(null);
  };

  const active = STUDIO_MODELS.find((m) => m.id === model)!;
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const artifact = lastAssistant ? extractArtifact(lastAssistant.content) : null;

  return (
    <div className="flex min-h-screen gap-4 p-4 md:gap-4 md:p-5">
      {/* Sidebar */}
      <aside className="glass glow-ring hidden w-68 shrink-0 flex-col rounded-3xl p-4 lg:flex">
        <div className="px-2 py-3">
          <span className="font-display text-gradient text-glow text-xl font-bold">
            Witz AI Studio
          </span>
        </div>
        <button onClick={newSession} className="btn-glow mt-2 w-full rounded-full px-4 py-3 text-sm">
          <Plus className="size-4" /> New session
        </button>

        <div className="mt-6 min-h-0 flex-1 overflow-y-auto pr-1">
          <p className="label-mono px-3 pb-2 text-muted-foreground">Saved chats</p>
          {!user && !authLoading && (
            <Link
              to="/auth"
              className="glass glow-hover block rounded-2xl px-3 py-3 text-xs text-muted-foreground"
            >
              Sign in to keep every session, attachment and artifact saved.
            </Link>
          )}
          {user && history.data?.length === 0 && (
            <p className="px-3 text-xs text-muted-foreground">No saved chats yet.</p>
          )}
          {history.data?.map((c) => (
            <div
              key={c.id}
              className={`group flex items-center gap-2 rounded-2xl px-3 py-2.5 text-sm transition-colors ${
                c.id === conversationId
                  ? "bg-glass-strong glow-ring text-primary"
                  : "text-muted-foreground hover:bg-glass hover:text-foreground"
              }`}
            >
              <button
                onClick={() => openConversation(c.id)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                <MessageSquare className="size-3.5 shrink-0" />
                <span className="truncate">{c.title}</span>
              </button>
              <button
                aria-label="Delete chat"
                onClick={async () => {
                  await deleteConversation(c.id);
                  if (c.id === conversationId) newSession();
                  qc.invalidateQueries({ queryKey: ["conversations", user?.id] });
                }}
                className="opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>

        <div className="mt-auto space-y-1 pt-4 text-sm text-muted-foreground">
          <button
            onClick={() => setShowKeys(true)}
            className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 hover:text-primary"
          >
            <KeyRound className="size-4" /> Your API key
          </button>
          <div className="flex items-center gap-3 rounded-2xl px-3 py-2.5">
            <Layers className="size-4" /> {STUDIO_MODELS.length} engines
          </div>
          <a
            href="https://cortex-ai-builder.lovable.app"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-glow flex w-full items-center gap-3 rounded-full px-3 py-2.5 text-center text-sm"
          >
            <Sparkles className="size-4" /> Make your own AI
          </a>
          {user ? (
            <button
              onClick={() => {
                supabase.auth.signOut();
                newSession();
              }}
              className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 hover:text-primary"
            >
              <LogOut className="size-4" /> Sign out
            </button>
          ) : (
            <Link to="/auth" className="flex items-center gap-3 rounded-2xl px-3 py-2.5 hover:text-primary">
              <LogIn className="size-4" /> Sign in
            </Link>
          )}
        </div>
      </aside>

      {/* Main */}
      <main className="flex min-w-0 flex-1 flex-col gap-4">
        <header className="glass glow-ring flex items-center justify-between gap-4 rounded-3xl px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="font-display text-gradient text-glow text-base font-bold lg:hidden">
              Witz
            </span>
            <div className="glass-strong flex items-center gap-2 rounded-full px-4 py-2">
              <Sparkles className="size-4 text-primary" />
              <div className="leading-tight">
                <p className="label-mono text-muted-foreground">Engine</p>
                <p className="text-sm font-medium">{active.name}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="label-mono hidden text-muted-foreground sm:inline">{active.badge}</span>
            <a
              href="https://cortex-ai-builder.lovable.app"
              target="_blank"
              rel="noopener noreferrer"
              className="glass glow-hover flex items-center gap-2 rounded-full px-3 py-2 text-xs text-muted-foreground hover:text-primary"
            >
              <Sparkles className="size-4" />
              <span className="hidden sm:inline">Make your own AI</span>
            </a>
            <a
              href="https://cortex-slm.lovable.app"
              target="_blank"
              rel="noopener noreferrer"
              className="glass glow-hover flex items-center gap-2 rounded-full px-3 py-2 text-xs text-muted-foreground hover:text-primary"
            >
              <Cpu className="size-4" />
              <span className="hidden sm:inline">Local LLM</span>
            </a>
            <button
              onClick={() => setShowKeys(true)}
              aria-label="Manage your API key"
              className="glass glow-hover rounded-full p-2 text-muted-foreground hover:text-primary"
            >
              <KeyRound className="size-4" />
            </button>
            {user ? (
              <span className="glass hidden rounded-full px-3 py-2 text-xs sm:inline">
                {user.email}
              </span>
            ) : (
              <Link to="/auth" className="btn-glow rounded-full px-4 py-2 text-xs">
                Sign in
              </Link>
            )}
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
                style={{ ["--glow-color" as string]: m.glow }}
                className={`min-w-[190px] flex-1 rounded-3xl p-4 text-left ${
                  on
                    ? "glass-strong glow-accent animate-witz-breathe"
                    : "glass glow-hover opacity-80 hover:opacity-100"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-display text-base font-semibold">{m.name}</span>
                  <span
                    className="label-mono rounded-full px-2 py-0.5"
                    style={{ color: m.glow, background: `color-mix(in oklch, ${m.glow} 16%, transparent)` }}
                  >
                    {m.badge}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{m.tagline}</p>
              </button>
            );
          })}
        </div>

        {/* Conversation */}
        <section className="glass glow-ring flex min-h-0 flex-1 flex-col rounded-3xl p-4 md:p-6">
          <div ref={scroller} className="min-h-[38vh] flex-1 space-y-4 overflow-y-auto pr-1">
            {messages.length === 0 && !busy && (
              <div className="flex h-full flex-col items-center justify-center py-10 text-center">
                <h1 className="text-gradient text-glow max-w-xl text-3xl font-bold md:text-5xl">
                  What are we building today?
                </h1>
                <p className="mt-3 max-w-md text-sm text-muted-foreground md:text-base">
                  Describe your vision, drop in files, and watch the studio light it up.
                </p>
                <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
                  <span className="label-mono text-muted-foreground">Suggested</span>
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="glass glow-hover rounded-full px-4 py-2 text-xs text-muted-foreground hover:text-primary"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`group relative max-w-[90%] rounded-3xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap md:max-w-[80%] ${
                    m.role === "user"
                      ? "bg-gradient-brand text-primary-foreground font-medium shadow-[0_0_28px_oklch(0.72_0.19_265/35%)]"
                      : "glass-strong font-mono text-[0.83rem]"
                  }`}
                >
                  {m.attachments && m.attachments.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-1">
                      {m.attachments.map((a) => (
                        <span
                          key={a}
                          className="label-mono rounded-full bg-black/25 px-2 py-0.5 text-[0.62rem]"
                        >
                          {a}
                        </span>
                      ))}
                    </div>
                  )}
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

            {busy && (
              <div className="glass-strong animate-witz-breathe inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs text-primary">
                <Loader2 className="size-3.5 animate-spin" />
                <span className="label-mono animate-witz-pulse">
                  {build.isPending ? "AI team building your project" : `${active.name} thinking`}
                </span>
              </div>
            )}

            {error && (
              <p className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-xs text-destructive-foreground">
                {error}
              </p>
            )}
          </div>

          {project ? (
            <ProjectWorkspace
              files={project.files}
              steps={project.steps}
              plan={project.plan}
              {...(project.mockup ? { mockup: project.mockup } : {})}
            />
          ) : (
            artifact && <ArtifactPanel artifact={artifact} />
          )}

          {/* Composer */}
          <div className="glass-strong glow-ring mt-4 rounded-3xl p-3">
            {attachments.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {attachments.map((a) => (
                  <span
                    key={a.name}
                    className="glass flex items-center gap-2 rounded-full px-3 py-1 text-xs text-primary"
                  >
                    <Paperclip className="size-3" />
                    {a.name}
                    <button
                      aria-label={`Remove ${a.name}`}
                      onClick={() => setAttachments((x) => x.filter((f) => f.name !== a.name))}
                      className="hover:text-destructive"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
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
              <div className="flex items-center gap-2">
                <input
                  ref={fileInput}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    onFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
                <button
                  onClick={() => fileInput.current?.click()}
                  aria-label="Attach files"
                  className="glass glow-hover rounded-full p-2 text-muted-foreground hover:text-primary"
                >
                  <Paperclip className="size-4" />
                </button>
                <button
                  onClick={() => setTeamMode((v) => !v)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-colors ${
                    teamMode ? "btn-glow" : "glass text-muted-foreground hover:text-primary"
                  }`}
                >
                  <Users className="size-3.5" /> AI team
                </button>
                <button
                  onClick={() => setWithMockup((v) => !v)}
                  disabled={!teamMode}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-colors disabled:opacity-40 ${
                    withMockup && teamMode
                      ? "glass text-primary"
                      : "glass text-muted-foreground hover:text-primary"
                  }`}
                >
                  <ImageIcon className="size-3.5" /> Design agent
                </button>
                <span className="label-mono hidden text-muted-foreground lg:inline">
                  {active.name} · {user ? "saving" : "not saved"}
                </span>
              </div>
              <button
                onClick={() => send(input)}
                disabled={busy || (!input.trim() && attachments.length === 0)}
                className="btn-glow rounded-full px-5 py-2.5 text-sm disabled:opacity-40"
              >
                {teamMode ? "Build" : "Generate"} <ArrowUp className="size-4" />
              </button>
            </div>
          </div>
        </section>
      </main>

      {showKeys && <ApiKeyDialog onClose={() => setShowKeys(false)} />}
    </div>
  );
}
