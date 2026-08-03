import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Download, Eye, Code2, Play, Rocket, ExternalLink } from "lucide-react";
import {
  type Artifact,
  fileNameFor,
  isRunnable,
  toPreviewDocument,
} from "@/lib/artifact";

type Tab = "preview" | "code";

export function ArtifactPanel({ artifact }: { artifact: Artifact }) {
  const [tab, setTab] = useState<Tab>(isRunnable(artifact.lang) ? "preview" : "code");
  const [code, setCode] = useState(artifact.code);
  const [runToken, setRunToken] = useState(0);
  const [copied, setCopied] = useState(false);
  const [published, setPublished] = useState<string | null>(null);

  useEffect(() => {
    setCode(artifact.code);
    setRunToken((n) => n + 1);
    setPublished(null);
    setTab(isRunnable(artifact.lang) ? "preview" : "code");
  }, [artifact]);

  const runnable = isRunnable(artifact.lang);
  const doc = useMemo(
    () => toPreviewDocument({ lang: artifact.lang, code }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [runToken, artifact.lang],
  );

  const download = () => {
    const url = URL.createObjectURL(new Blob([code], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = fileNameFor(artifact.lang);
    a.click();
    URL.revokeObjectURL(url);
  };

  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const publish = () => {
    const url = URL.createObjectURL(
      new Blob([toPreviewDocument({ lang: artifact.lang, code })], { type: "text/html" }),
    );
    setPublished(url);
    window.open(url, "_blank", "noopener");
  };

  return (
    <div className="glass-strong mt-4 overflow-hidden rounded-3xl">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2.5">
        <div className="glass flex rounded-full p-1">
          {(["preview", "code"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              disabled={t === "preview" && !runnable}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium capitalize transition-colors disabled:opacity-40 ${
                tab === t ? "bg-gradient-brand text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {t === "preview" ? <Eye className="size-3.5" /> : <Code2 className="size-3.5" />}
              {t}
            </button>
          ))}
        </div>
        <span className="label-mono text-muted-foreground">{artifact.lang}</span>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Action onClick={() => setRunToken((n) => n + 1)} disabled={!runnable} icon={Play}>
            Run
          </Action>
          <Action onClick={copy} icon={copied ? Check : Copy}>
            {copied ? "Copied" : "Copy"}
          </Action>
          <Action onClick={download} icon={Download}>
            Download
          </Action>
          <button
            onClick={publish}
            disabled={!runnable}
            className="inline-flex items-center gap-1.5 rounded-full bg-gradient-brand px-3.5 py-1.5 text-xs font-semibold text-primary-foreground transition-transform hover:scale-[1.03] disabled:opacity-40 disabled:hover:scale-100"
          >
            <Rocket className="size-3.5" /> Publish
          </button>
        </div>
      </div>

      {tab === "preview" ? (
        <iframe
          key={runToken}
          title="Artifact preview"
          srcDoc={doc}
          sandbox="allow-scripts"
          className="h-[420px] w-full bg-background"
        />
      ) : (
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          spellCheck={false}
          className="h-[420px] w-full resize-none bg-transparent p-4 font-mono text-[0.8rem] leading-relaxed outline-none"
        />
      )}

      {published && (
        <a
          href={published}
          target="_blank"
          rel="noopener"
          className="flex items-center gap-1.5 border-t border-border px-4 py-2.5 text-xs text-primary"
        >
          <ExternalLink className="size-3.5" /> Published preview opened in a new tab — click to
          reopen
        </a>
      )}
    </div>
  );
}

function Action({
  onClick,
  icon: Icon,
  disabled,
  children,
}: {
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="glass inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-primary disabled:opacity-40"
    >
      <Icon className="size-3.5" /> {children}
    </button>
  );
}
