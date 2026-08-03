export type Artifact = { lang: string; code: string };

const FENCE = /```([a-zA-Z0-9+#-]*)\n([\s\S]*?)```/g;

/** Extract the largest fenced code block from a message, preferring web languages. */
export function extractArtifact(text: string): Artifact | null {
  const blocks: Artifact[] = [];
  for (const m of text.matchAll(FENCE)) {
    blocks.push({ lang: (m[1] || "text").toLowerCase(), code: m[2].trim() });
  }
  if (blocks.length === 0) return null;
  const web = blocks.filter((b) => ["html", "htm", "svg"].includes(b.lang));
  const pool = web.length ? web : blocks;
  return pool.reduce((a, b) => (b.code.length > a.code.length ? b : a));
}

export function isRunnable(lang: string) {
  return ["html", "htm", "svg", "css", "js", "javascript", "jsx", "ts", "tsx"].includes(lang);
}

const EXT: Record<string, string> = {
  html: "html",
  htm: "html",
  svg: "svg",
  css: "css",
  js: "js",
  javascript: "js",
  jsx: "jsx",
  ts: "ts",
  tsx: "tsx",
  json: "json",
  python: "py",
  bash: "sh",
  sql: "sql",
};

export function fileNameFor(lang: string) {
  return `witz-studio.${EXT[lang] ?? "txt"}`;
}

/** Wrap raw code into a self-contained HTML document for the preview iframe. */
export function toPreviewDocument({ lang, code }: Artifact) {
  const base = `<style>html,body{margin:0;font-family:ui-sans-serif,system-ui,sans-serif;background:#0b0b12;color:#e9e9f2}</style>`;
  if (lang === "html" || lang === "htm") {
    return /<html[\s>]/i.test(code) ? code : `<!doctype html><html><head>${base}</head><body>${code}</body></html>`;
  }
  if (lang === "svg") return `<!doctype html><html><head>${base}</head><body>${code}</body></html>`;
  if (lang === "css") {
    return `<!doctype html><html><head>${base}<style>${code}</style></head><body><div class="preview"><h1>Heading</h1><p>Styled preview sample.</p><button>Button</button></div></body></html>`;
  }
  return `<!doctype html><html><head>${base}</head><body><div id="root"></div><script>try{${code}}catch(e){document.body.innerHTML='<pre style="color:#ff8080">'+e+'</pre>'}<\/script></body></html>`;
}
