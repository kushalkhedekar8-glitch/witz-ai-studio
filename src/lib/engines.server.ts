/** Server-only provider routing for the studio engines. Vendor names never leave this file. */

export type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

export type Byok = { apiKey: string; model: string; baseUrl?: string | undefined };

type Route = { url: string; key: string; model: string };

const LOVABLE = (model = "google/gemini-3.6-flash"): Route => ({
  url: "https://ai.gateway.lovable.dev/v1/chat/completions",
  key: process.env["LOVABLE_API_KEY"] ?? "",
  model,
});

function byokRoute(byok?: Byok): Route | null {
  if (!byok?.apiKey || !byok.model) return null;
  const base = (byok.baseUrl ?? "https://openrouter.ai/api/v1").replace(/\/+$/, "");
  return { url: `${base}/chat/completions`, key: byok.apiKey, model: byok.model };
}

const GROQ = (): Route => ({
  url: "https://api.groq.com/openai/v1/chat/completions",
  key: process.env["GROQ_API_KEY"] ?? "",
  model: "llama-3.3-70b-versatile",
});
const OPENAI = (): Route => ({
  url: "https://api.openai.com/v1/chat/completions",
  key: process.env["OPENAI_API_KEY"] ?? "",
  model: "gpt-4o-mini",
});
const GEMINI = (): Route => ({
  url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
  key: process.env["GOOGLE_API_KEY"] ?? "",
  model: "gemini-2.0-flash",
});
const ROUTER = (model: string): Route => ({
  url: "https://openrouter.ai/api/v1/chat/completions",
  key: process.env["OPENROUTER_API_KEY"] ?? "",
  model,
});

/** Ordered attempt chain per engine: chosen provider, user key, then every other lane. */
function chain(engine: string, byok?: Byok): Route[] {
  const user = byokRoute(byok);

  let primary: Route | null = null;
  switch (engine) {
    case "cortex":
      primary = LOVABLE();
      break;
    case "nova":
      primary = GROQ();
      break;
    case "quartz":
      primary = OPENAI();
      break;
    case "prism":
      primary = GEMINI();
      break;
    case "atlas":
      primary = ROUTER("anthropic/claude-3.5-sonnet");
      break;
    case "custom":
      primary = user;
      break;
    default:
      primary = LOVABLE();
  }

  const routes = [
    primary,
    user,
    OPENAI(),
    GROQ(),
    GEMINI(),
    ROUTER("meta-llama/llama-3.3-70b-instruct"),
    LOVABLE(),
  ].filter((r): r is Route => !!r && !!r.key && !!r.model);
  // de-dupe identical routes
  return routes.filter(
    (r, i) => routes.findIndex((o) => o.url === r.url && o.model === r.model) === i,
  );
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function headersFor(route: Route): Record<string, string> {
  const isLovable = route.url.startsWith("https://ai.gateway.lovable.dev");
  return {
    "Content-Type": "application/json",
    ...(isLovable ? { "Lovable-API-Key": route.key } : { Authorization: `Bearer ${route.key}` }),
  };
}

export type ChatResult = { text: string; error?: string };

/** Calls the engine, transparently falling back to the user's key / built-in AI. */
export async function chat(
  engine: string,
  messages: ChatMessage[],
  byok?: Byok | undefined,
): Promise<ChatResult> {
  const routes = chain(engine, byok);
  if (routes.length === 0)
    return { text: "", error: "This engine has no key configured. Add your own key in API keys." };

  let lastError = "The engine did not respond. Please try again.";

  for (const route of routes) {
    const body = JSON.stringify({ model: route.model, messages });
    for (let attempt = 0; attempt < 2; attempt++) {
      let res: Response;
      try {
        res = await fetch(route.url, { method: "POST", headers: headersFor(route), body });
      } catch {
        lastError = "Could not reach the engine. Check your connection and retry.";
        break;
      }

      if (res.ok) {
        const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
        return { text: json.choices?.[0]?.message?.content ?? "" };
      }

      const detail = (await res.text()).slice(0, 180);
      if ((res.status === 429 || res.status >= 500) && attempt === 0) {
        await sleep(1000);
        continue;
      }
      if (res.status === 402) lastError = "Credits exhausted — switching to your own key helps here.";
      else if (res.status === 401 || res.status === 403) lastError = "That key was rejected.";
      else if (res.status === 429) lastError = "Rate limited — try again shortly.";
      else lastError = `Engine error (${res.status}): ${detail}`;
      break;
    }
  }

  return { text: "", error: lastError };
}

export const SYSTEM_PROMPT =
  "You are the assistant inside Witz AI Studio. Be precise, concise and helpful. " +
  "When asked for code, return clean, production-ready code in fenced blocks. " +
  "Never reveal or discuss which underlying provider or model powers you; you are simply the studio engine the user selected.";

/* ── Multi-agent project builder ─────────────────────────────────────── */

export type ProjectFile = { path: string; code: string };
export type BuildStep = { agent: string; role: string; status: "done" | "failed"; note?: string };
export type BuildResult = {
  plan: string;
  files: ProjectFile[];
  steps: BuildStep[];
  mockup?: string;
  error?: string;
};

function fenced(text: string) {
  const m = text.match(/```[a-zA-Z]*\n([\s\S]*?)```/);
  return ((m ? m[1] : text) ?? text).trim();
}

async function agent(
  engine: string,
  byok: Byok | undefined,
  system: string,
  user: string,
): Promise<ChatResult> {
  return chat(engine, [
    { role: "system", content: system },
    { role: "user", content: user },
  ], byok);
}

/** Ask the built-in image engine for a UI concept board. Degrades silently. */
async function designMockup(brief: string): Promise<string | undefined> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) return undefined;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        prompt:
          "Clean futuristic web UI design mockup, blue and purple gradient background, glassmorphism cards, glowing buttons, for: " +
          brief,
        n: 1,
      }),
    });
    if (!res.ok) return undefined;
    const json = (await res.json()) as { data?: Array<{ b64_json?: string; url?: string }> };
    const item = json.data?.[0];
    if (item?.b64_json) return `data:image/png;base64,${item.b64_json}`;
    return item?.url;
  } catch {
    return undefined;
  }
}

/**
 * Director agent reads the prompt, then specialised agents split the work:
 * design concept, markup, styles and behaviour — assembled into one project.
 */
export async function buildProject(opts: {
  brief: string;
  engine: string;
  byok?: Byok | undefined;
  team: boolean;
  withMockup: boolean;
  images?: string[];
}): Promise<BuildResult> {
  const { brief, engine, byok, team, withMockup } = opts;
  const images = opts.images ?? [];
  const imageNote = images.length
    ? `\n\nUse these real image URLs (already sourced from the internet) in <img> tags where imagery fits:\n${images.join("\n")}`
    : "";
  const steps: BuildStep[] = [];

  if (!team) {
    const solo = await agent(
      engine,
      byok,
      SYSTEM_PROMPT +
        " Build a complete single-file website. Return exactly three fenced blocks in order: html (body markup only), css, js.",
      brief,
    );
    if (solo.error) return { plan: "", files: [], steps, error: solo.error };
    const blocks = [...solo.text.matchAll(/```([a-zA-Z]*)\n([\s\S]*?)```/g)];
    const pick = (lang: string) =>
      blocks.find((b) => (b[1] ?? "").toLowerCase().startsWith(lang))?.[2]?.trim() ?? "";
    steps.push({ agent: "Solo build", role: "markup + styles + behaviour", status: "done" });
    return {
      plan: (solo.text.split("```")[0] ?? "").trim(),
      steps,
      files: [
        { path: "index.html", code: pick("htm") || solo.text },
        { path: "styles.css", code: pick("css") },
        { path: "script.js", code: pick("j") },
      ].filter((f) => f.code),
    };
  }

  // 1. Director: turn the prompt into a build brief the other agents share.
  const director = await agent(
    "cortex",
    byok,
    "You are the Director agent of an AI build team. Read the user's request and write a tight build brief " +
      "(max 200 words) covering: purpose, sections in order, visual direction (colors, typography, mood), " +
      "and any interactivity needed. Plain text only, no code.",
    brief,
  );
  if (director.error) return { plan: "", files: [], steps, error: director.error };
  const plan = director.text.trim();
  steps.push({ agent: "Director", role: "understood the prompt and split the work", status: "done" });

  const [mockup, markup, styles, script] = await Promise.all([
    withMockup ? designMockup(plan) : Promise.resolve(undefined),
    agent(
      engine,
      byok,
      "You are the Markup agent. Output ONLY the semantic HTML for inside <body> (no <html>, <head>, <style> or <script>). " +
        "Link nothing; other agents own styles.css and script.js. Use clear class names and data hooks.",
      `Build brief:\n${plan}\n\nOriginal request: ${brief}${imageNote}`,
    ),
    agent(
      engine,
      byok,
      "You are the Styles agent. Output ONLY CSS. Modern, responsive, futuristic: blue/purple gradient background, " +
        "glassmorphism surfaces, glowing buttons, smooth transitions. Assume the markup uses descriptive class names from the brief.",
      `Build brief:\n${plan}\n\nOriginal request: ${brief}`,
    ),
    agent(
      engine,
      byok,
      "You are the Behaviour agent. Output ONLY vanilla JavaScript (no imports, no frameworks) that wires up the interactivity " +
        "described in the brief, guarding for missing elements.",
      `Build brief:\n${plan}\n\nOriginal request: ${brief}`,
    ),
  ]);

  for (const [name, role, r] of [
    ["Markup agent", "HTML structure", markup],
    ["Styles agent", "CSS design system", styles],
    ["Behaviour agent", "JavaScript interactivity", script],
  ] as const) {
    steps.push({
      agent: name,
      role,
      status: r.error ? "failed" : "done",
      ...(r.error ? { note: r.error } : {}),
    });
  }
  if (mockup) steps.unshift({ agent: "Design agent", role: "UI concept board", status: "done" });

  const files: ProjectFile[] = [
    { path: "index.html", code: fenced(markup.text) },
    { path: "styles.css", code: fenced(styles.text) },
    { path: "script.js", code: fenced(script.text) },
  ].filter((f) => f.code);

  if (files.length === 0)
    return { plan, files, steps, error: markup.error ?? "The team could not produce any files." };

  return { plan, files, steps, ...(mockup ? { mockup } : {}) };
}
