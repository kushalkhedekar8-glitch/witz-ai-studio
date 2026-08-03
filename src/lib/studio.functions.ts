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
});

type Route = {
  url: string;
  headers: () => Record<string, string>;
  model: string;
};

function resolveRoute(id: string): Route {
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

export const runStudio = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data }) => {
    const route = resolveRoute(data.model);

    const res = await fetch(route.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...route.headers() },
      body: JSON.stringify({
        model: route.model,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...data.messages],
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      if (res.status === 429) throw new Error("Rate limited — please try again in a moment.");
      if (res.status === 402) throw new Error("This engine is out of credits.");
      throw new Error(`Engine error (${res.status}): ${detail.slice(0, 300)}`);
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = json.choices?.[0]?.message?.content ?? "";
    return { text };
  });
