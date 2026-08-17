/** Server-only Organizer agent: reads the prompt and decides which specialist runs. */

import { chat, type Byok } from "./engines.server";

export type TaskKind = "image" | "video" | "voice" | "code" | "chat";

export type Plan = {
  kind: TaskKind;
  prompt: string;
  imageQueries: string[];
  reason: string;
};

function heuristic(text: string): TaskKind {
  const t = text.toLowerCase();
  if (/\b(video|clip|animate|animation|reel|footage|movie)\b/.test(t)) return "video";
  if (/\b(voice|speak|narrate|narration|say|audio|tts|podcast)\b/.test(t)) return "voice";
  if (/\b(image|picture|photo|logo|icon|illustration|poster|art|draw|render)\b/.test(t))
    return "image";
  if (/\b(website|web app|landing|page|component|app|code|html|css|js|dashboard|ui)\b/.test(t))
    return "code";
  return "chat";
}

const SYSTEM =
  "You are the Organizer agent of an AI studio. Classify the user's request and reply with STRICT JSON only, " +
  'no prose, no code fences: {"kind":"image|video|voice|code|chat","prompt":"the cleaned brief for the specialist",' +
  '"imageQueries":["short search phrases for photos the project needs (max 3, empty if none)"],' +
  '"reason":"one short sentence"}. ' +
  "Use image for still visuals, video for moving footage, voice for speech/audio, code for websites/apps/components, chat for questions and text.";

/** Organizer runs on the studio's reasoning engine; falls back to keywords. */
export async function organize(brief: string, byok?: Byok | undefined): Promise<Plan> {
  const fallback: Plan = {
    kind: heuristic(brief),
    prompt: brief,
    imageQueries: [],
    reason: "Routed by keywords.",
  };

  const res = await chat(
    "prism",
    [
      { role: "system", content: SYSTEM },
      { role: "user", content: brief.slice(0, 4000) },
    ],
    byok,
  );
  if (res.error || !res.text) return fallback;

  const match = res.text.match(/\{[\s\S]*\}/);
  if (!match) return fallback;
  try {
    const parsed = JSON.parse(match[0]) as Partial<Plan>;
    const kinds: TaskKind[] = ["image", "video", "voice", "code", "chat"];
    const kind = kinds.includes(parsed.kind as TaskKind) ? (parsed.kind as TaskKind) : fallback.kind;
    return {
      kind,
      prompt: (parsed.prompt || brief).slice(0, 4000),
      imageQueries: Array.isArray(parsed.imageQueries)
        ? parsed.imageQueries.filter((q) => typeof q === "string").slice(0, 3)
        : [],
      reason: parsed.reason || "Organizer routed this request.",
    };
  } catch {
    return fallback;
  }
}
