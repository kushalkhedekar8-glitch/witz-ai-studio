import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  model: z.string(),
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant", "system"]),
      content: z.string(),
    }),
  ),
  /** Optional bring-your-own-key config, supplied per request by the user. */
  byok: z
    .object({
      baseUrl: z.string().url().optional(),
      apiKey: z.string().min(8),
      model: z.string().min(1),
    })
    .optional(),
});

type Route = {
  url: string;
  headers: () => Record<string, string>;
  model: string;
};

function resolveRoute(id: string, byok?: z.infer<typeof schema>["byok"]): Route {
  if (id === "custom") {
    if (!byok) throw new Error("Add your own API key in Settings to use this engine.");
    const base = (byok.baseUrl ?? "https://openrouter.ai/api/v1").replace(/\/+$/, "");
    return {
      url: `${base}/chat/completions`,
      headers: () => ({ Authorization: `Bearer ${byok.apiKey}` }),
      model: byok.model,
    };
  }
  if (id === "cortex") {
    return {
      url: "https://ai.gateway.lovable.dev/v1/chat/completions",
      headers: () => ({ "Lovable-API-Key": process.env["LOVABLE_API_KEY"] ?? "" }),
      model: "google/gemini-3.6-flash",
    };
  }
  if (id === "quartz") {
    return {
      url: "https://api.openai.com/v1/chat/completions",
      headers: () => ({ Authorization: `Bearer ${process.env["OPENAI_API_KEY"] ?? ""}` }),
      model: "gpt-4o-mini",
    };
  }
  const openrouter = (model: string): Route => ({
    url: "https://openrouter.ai/api/v1/chat/completions",
    headers: () => ({ Authorization: `Bearer ${process.env["OPENROUTER_API_KEY"] ?? ""}` }),
    model,
  });
  if (id === "atlas") return openrouter("anthropic/claude-3.5-sonnet");
  return openrouter("meta-llama/llama-3.3-70b-instruct");
}

const SYSTEM_PROMPT =
  "You are the assistant inside Witz AI Studio. Be precise, concise and helpful. " +
  "When asked for code, return clean, production-ready code in fenced blocks. " +
  "Never reveal or discuss which underlying provider or model powers you; you are simply the studio engine the user selected.";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const runStudio = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data }): Promise<{ text: string; error?: string }> => {
    let route: Route;
    try {
      route = resolveRoute(data.model, data.byok);
    } catch (e) {
      return { text: "", error: e instanceof Error ? e.message : "Engine unavailable." };
    }

    const body = JSON.stringify({
      model: route.model,
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...data.messages],
    });

    // Retry transient rate limits / upstream hiccups with backoff.
    for (let attempt = 0; attempt < 3; attempt++) {
      let res: Response;
      try {
        res = await fetch(route.url, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...route.headers() },
          body,
        });
      } catch {
        if (attempt < 2) {
          await sleep(800 * (attempt + 1));
          continue;
        }
        return { text: "", error: "Could not reach the engine. Check your connection and retry." };
      }

      if (res.ok) {
        const json = (await res.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        return { text: json.choices?.[0]?.message?.content ?? "" };
      }

      const detail = await res.text();
      const retryable = res.status === 429 || res.status >= 500;
      if (retryable && attempt < 2) {
        await sleep(1200 * (attempt + 1));
        continue;
      }

      if (res.status === 401 || res.status === 403)
        return { text: "", error: "That API key was rejected — check it and try again." };
      if (res.status === 429)
        return {
          text: "",
          error: "This engine is rate limited right now. Try again shortly or switch engines.",
        };
      if (res.status === 402)
        return { text: "", error: "This engine is out of credits. Switch engines or add credits." };
      return { text: "", error: `Engine error (${res.status}): ${detail.slice(0, 200)}` };
    }

    return { text: "", error: "The engine did not respond. Please try again." };
  });

