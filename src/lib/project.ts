export type ProjectFile = { path: string; code: string };
export type BuildStep = { agent: string; role: string; status: "done" | "failed"; note?: string };
export type BuildResult = {
  plan: string;
  files: ProjectFile[];
  steps: BuildStep[];
  mockup?: string;
  error?: string;
};

/** Stitch the generated files into one runnable document for preview / publish. */
export function buildPreviewDocument(files: ProjectFile[]) {
  const get = (path: string) => files.find((f) => f.path === path)?.code ?? "";
  const html = get("index.html");
  const css = get("styles.css");
  const js = get("script.js");

  if (/<html[\s>]/i.test(html)) return html;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Witz Studio build</title>
<style>${css}</style>
</head>
<body>
${html}
<script>try{${js}}catch(e){console.error(e)}<\/script>
</body>
</html>`;
}
