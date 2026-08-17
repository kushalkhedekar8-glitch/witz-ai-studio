/** Server-only media pipeline: web image lookup, image / video / voice generation. */

const LOVABLE = () => process.env["LOVABLE_API_KEY"] ?? "";

export type MediaResult = { url?: string; note?: string; error?: string };

/* ── Images ──────────────────────────────────────────────────────────── */

/** Look for an existing, openly licensed image on the internet (no key needed). */
export async function searchWebImage(query: string): Promise<string | undefined> {
  try {
    const url =
      "https://api.openverse.org/v1/images/?page_size=3&license_type=commercial&q=" +
      encodeURIComponent(query.slice(0, 120));
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return undefined;
    const json = (await res.json()) as { results?: Array<{ url?: string }> };
    return json.results?.find((r) => !!r.url)?.url;
  } catch {
    return undefined;
  }
}

/** Several web images for a site build (hero, sections…). */
export async function searchWebImages(queries: string[]): Promise<string[]> {
  const found = await Promise.all(queries.map((q) => searchWebImage(q)));
  return found.filter((u): u is string => !!u);
}

export async function generateImage(prompt: string, model?: string): Promise<MediaResult> {
  const key = LOVABLE();
  if (!key) return { error: "The image engine is not configured." };
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: model === "aurora" ? "google/gemini-3.1-flash-image" : "google/gemini-2.5-flash-image",
        prompt,
        n: 1,
      }),
    });
    if (!res.ok) return { error: `Image engine error (${res.status}).` };
    const json = (await res.json()) as { data?: Array<{ b64_json?: string; url?: string }> };
    const item = json.data?.[0];
    if (item?.b64_json) return { url: `data:image/png;base64,${item.b64_json}` };
    if (item?.url) return { url: item.url };
    return { error: "The image engine returned nothing." };
  } catch {
    return { error: "Could not reach the image engine." };
  }
}

/**
 * Internet first, generation second: reuse an existing photo when one matches,
 * otherwise draw it with the image engine.
 */
export async function sourceImage(
  prompt: string,
  opts?: { preferWeb?: boolean; model?: string },
): Promise<MediaResult> {
  if (opts?.preferWeb !== false) {
    const web = await searchWebImage(prompt);
    if (web) return { url: web, note: "Found an existing image on the internet." };
  }
  const made = await generateImage(prompt, opts?.model);
  return made.url ? { ...made, note: "No good match online — generated a new image." } : made;
}

/* ── Video ───────────────────────────────────────────────────────────── */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function generateVideo(prompt: string, model?: string): Promise<MediaResult> {
  const key = LOVABLE();
  if (!key) return { error: "The video engine is not configured." };
  const auth = { Authorization: `Bearer ${key}` };
  try {
    const create = await fetch("https://ai.gateway.lovable.dev/v1/videos", {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: model === "reel" ? "google/veo-3.1-fast" : "google/veo-3.1-lite",
        prompt,
        seconds: "4",
        size: "1280x720",
      }),
    });
    if (!create.ok) {
      const detail = (await create.text()).slice(0, 160);
      return { error: `Video engine error (${create.status}): ${detail}` };
    }
    const job = (await create.json()) as { id: string };

    for (let i = 0; i < 40; i++) {
      await sleep(5000);
      const poll = await fetch(`https://ai.gateway.lovable.dev/v1/videos/${job.id}`, {
        headers: auth,
      });
      if (!poll.ok) continue;
      const state = (await poll.json()) as {
        status: string;
        error?: { message?: string };
      };
      if (state.status === "failed")
        return { error: state.error?.message ?? "The video engine failed." };
      if (state.status !== "completed") continue;

      const content = await fetch(`https://ai.gateway.lovable.dev/v1/videos/${job.id}/content`, {
        headers: auth,
      });
      if (!content.ok) return { error: "Could not download the finished video." };
      const bytes = new Uint8Array(await content.arrayBuffer());
      let binary = "";
      for (const b of bytes) binary += String.fromCharCode(b);
      return { url: `data:video/mp4;base64,${btoa(binary)}`, note: "Rendered a 4 second clip." };
    }
    return { error: "The video is taking longer than expected — try again." };
  } catch {
    return { error: "Could not reach the video engine." };
  }
}

/* ── Voice ───────────────────────────────────────────────────────────── */

export async function generateVoice(text: string, model?: string): Promise<MediaResult> {
  const key = process.env["ELEVENLABS_API_KEY"] ?? "";
  if (!key) return { error: "The voice engine is not configured." };
  const voice = model === "echo" ? "CwhRBWXzGAHq8TQ4Fs17" : "9BWtsMINqrJLrRacOk9x";
  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        text: text.slice(0, 2500),
        model_id: "eleven_multilingual_v2",
      }),
    });
    if (!res.ok) return { error: `Voice engine error (${res.status}).` };
    const bytes = new Uint8Array(await res.arrayBuffer());
    let binary = "";
    for (const b of bytes) binary += String.fromCharCode(b);
    return { url: `data:audio/mpeg;base64,${btoa(binary)}`, note: "Voice ready." };
  } catch {
    return { error: "Could not reach the voice engine." };
  }
}
