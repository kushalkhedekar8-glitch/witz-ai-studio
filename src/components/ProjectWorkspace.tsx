import { useEffect, useMemo, useState } from "react";
import JSZip from "jszip";
import {
  Check,
  Code2,
  Copy,
  Download,
  Eye,
  ExternalLink,
  FileCode2,
  Play,
  Rocket,
  Sparkles,
  Users,
} from "lucide-react";
import type { BuildStep, ProjectFile } from "@/lib/project";
import { buildPreviewDocument } from "@/lib/project";

type Tab = "preview" | "code" | "team";

export function ProjectWorkspace({
  files: initial,
  steps,
  plan,
  mockup,
}: {
  files: ProjectFile[];
  steps: BuildStep[];
  plan: string;
  mockup?: string;
}) {
  const [files, setFiles] = useState(initial);
  const [activePath, setActivePath] = useState(initial[0]?.path ?? "index.html");
  const [tab, setTab] = useState<Tab>("preview");
  const [runToken, setRunToken] = useState(0);
  const [copied, setCopied] = useState(false);
  const [published, setPublished] = useState<string | null>(null);

  useEffect(() => {
    setFiles(initial);
    setActivePath(initial[0]?.path ?? "index.html");
    setTab("preview");
    setRunToken((n) => n + 1);
    setPublished(null);
  }, [initial]);

  const active = files.find((f) => f.path === activePath) ?? files[0];
  const doc = useMemo(
    () => buildPreviewDocument(files),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [runToken],
  );

  const update = (code: string) =>
    setFiles((fs) => fs.map((f) => (f.path === activePath ? { ...f, code } : f)));

  const copy = async () => {
    await navigator.clipboard.writeText(active?.code ?? "");
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  const downloadZip = async () => {
    const zip = new JSZip();
    for (const f of files) zip.file(f.path, f.code);
    zip.file("preview.html", buildPreviewDocument(files));
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "witz-project.zip";
    a.click();
    URL.revokeObjectURL(url);
  };

  const publish = () => {
    const url = URL.createObjectURL(new Blob([buildPreviewDocument(files)], { type: "text/html" }));
    setPublished(url);
    window.open(url, "_blank", "noopener");
  };

  return (
    <div className="glass-strong glow-ring mt-4 overflow-hidden rounded-3xl">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2.5">
        <div className="glass flex rounded-full p-1">
          {(["preview", "code", "team"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                tab === t ? "bg-gradient-brand text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {t === "preview" ? (
                <Eye className="size-3.5" />
              ) : t === "code" ? (
                <Code2 className="size-3.5" />
              ) : (
                <Users className="size-3.5" />
              )}
              {t}
            </button>
          ))}
        </div>
        <span className="label-mono text-muted-foreground">{files.length} files</span>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Action onClick={() => setRunToken((n) => n + 1)} icon={Play}>
            Run
          </Action>
          <Action onClick={copy} icon={copied ? Check : Copy}>
            {copied ? "Copied" : "Copy"}
          </Action>
          <Action onClick={downloadZip} icon={Download}>
            ZIP
          </Action>
          <button
            onClick={publish}
            className="btn-glow rounded-full px-3.5 py-1.5 text-xs"
          >
            <Rocket className="size-3.5" /> Publish
          </button>
        </div>
      </div>

      {tab === "preview" && (
        <iframe
          key={runToken}
          title="Project preview"
          srcDoc={doc}
          sandbox="allow-scripts"
          className="h-[460px] w-full bg-background"
        />
      )}

      {tab === "code" && (
        <div className="flex min-h-[460px] flex-col sm:flex-row">
          <div className="flex shrink-0 gap-1 border-border p-2 sm:w-44 sm:flex-col sm:border-r">
            {files.map((f) => (
              <button
                key={f.path}
                onClick={() => setActivePath(f.path)}
                className={`flex items-center gap-2 rounded-xl px-3 py-2 text-left text-xs transition-colors ${
                  f.path === activePath
                    ? "glass text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <FileCode2 className="size-3.5 shrink-0" />
                <span className="truncate">{f.path}</span>
              </button>
            ))}
          </div>
          <textarea
            value={active?.code ?? ""}
            onChange={(e) => update(e.target.value)}
            spellCheck={false}
            className="min-h-[460px] flex-1 resize-none bg-transparent p-4 font-mono text-[0.8rem] leading-relaxed outline-none"
          />
        </div>
      )}

      {tab === "team" && (
        <div className="space-y-4 p-4">
          {mockup && (
            <div>
              <p className="label-mono mb-2 text-muted-foreground">Design concept</p>
              <img
                src={mockup}
                alt="AI generated UI design concept for the project"
                className="glass w-full rounded-2xl"
                loading="lazy"
              />
            </div>
          )}
          <div>
            <p className="label-mono mb-2 text-muted-foreground">Build brief</p>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{plan}</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {steps.map((s) => (
              <div key={s.agent} className="glass glow-hover rounded-2xl px-4 py-3">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <Sparkles className="size-3.5 text-primary" /> {s.agent}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{s.role}</p>
                <p
                  className={`label-mono mt-2 ${
                    s.status === "done" ? "text-primary" : "text-destructive"
                  }`}
                >
                  {s.status === "done" ? "completed" : (s.note ?? "failed")}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {published && (
        <a
          href={published}
          target="_blank"
          rel="noopener"
          className="flex items-center gap-1.5 border-t border-border px-4 py-2.5 text-xs text-primary"
        >
          <ExternalLink className="size-3.5" /> Published build opened in a new tab — click to reopen
        </a>
      )}
    </div>
  );
}

function Action({
  onClick,
  icon: Icon,
  children,
}: {
  onClick: () => void;
  icon: typeof Play;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="glass glow-hover inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-muted-foreground hover:text-primary"
    >
      <Icon className="size-3.5" /> {children}
    </button>
  );
}
