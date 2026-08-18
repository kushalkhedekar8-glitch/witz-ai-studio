/** Server-only media pipeline: web image lookup, image / video / voice generation.
 *  Every lane tries several providers in order and degrades gracefully. */

const env = (name: string) => process.env[name] ?? "";
const LOVABLE = () => env("LOVABLE_API_KEY");

export type MediaResult = { url?: string; note?: string; error?: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

/** Fast, high-quality image provider. */
async function falImage(prompt: string, model: string): Promise<MediaResult> {
  const key = env("FAL_API_KEY");
  if (!key) return { error: "not configured" };
  const endpoint =
    model === "aurora" ? "fal-ai/flux/dev" : "fal-ai/flux/schnell";
  try {
    const res = await fetch(`https://fal.run/${endpoint}`, {
      method: "POST",
      headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, num_images: 1, image_size: "landscape_16_9" }),
    });
    if (!res.ok) return { error: `image provider ${res.status}` };
    const json = (await res.json()) as { images?: Array<{ url?: string }> };
    const url = json.images?.[0]?.url;
    return url ? { url } : { error: "empty image response" };
  } catch {
    return { error: "image provider unreachable" };
  }
}

/** Image through the aggregated router (chat-completions image modality). */
async function routerImage(prompt: string): Promise<MediaResult> {
  const key = env("OPENROUTER_API_KEY");
  if (!key) return { error: "not configured" };
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image-preview",
        modalities: ["image", "text"],
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) return { error: `image router ${res.status}` };
    const json = (await res.json()) as {
      choices?: Array<{ message?: { images?: Array<{ image_url?: { url?: string } }> } }>;
    };
    const url = json.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    return url ? { url } : { error: "empty image response" };
  } catch {
    return { error: "image router unreachable" };
  }
}

/** Built-in studio image engine. */
async function builtInImage(prompt: string, model?: string): Promise<MediaResult> {
  const key = LOVABLE();
  if (!key) return { error: "not configured" };
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model:
          model === "aurora" ? "google/gemini-3.1-flash-image" : "google/gemini-2.5-flash-image",
        prompt,
        n: 1,
      }),
    });
    if (!res.ok) return { error: `built-in image ${res.status}` };
    const json = (await res.json()) as { data?: Array<{ b64_json?: string; url?: string }> };
    const item = json.data?.[0];
    if (item?.b64_json) return { url: `data:image/png;base64,${item.b64_json}` };
    if (item?.url) return { url: item.url };
    return { error: "empty image response" };
  } catch {
    return { error: "built-in image unreachable" };
  }
}

export async function generateImage(prompt: string, model?: string): Promise<MediaResult> {
  const lanes = [
    () => falImage(prompt, model ?? "canvas"),
    () => routerImage(prompt),
    () => builtInImage(prompt, model),
  ];
  let last = "The image engine is not configured.";
  for (const lane of lanes) {
    const res = await lane();
    if (res.url) return res;
    if (res.error) last = res.error;
  }
  return { error: `Could not produce an image (${last}).` };
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

async function falVideo(prompt: string): Promise<MediaResult> {
  const key = env("FAL_API_KEY");
  if (!key) return { error: "not configured" };
  const headers = { Authorization: `Key ${key}`, "Content-Type": "application/json" };
  try {
    const submit = await fetch(
      "https://queue.fal.run/fal-ai/kling-video/v1/standard/text-to-video",
      { method: "POST", headers, body: JSON.stringify({ prompt, duration: "5" }) },
    );
    if (!submit.ok) return { error: `video provider ${submit.status}` };
    const job = (await submit.json()) as { status_url?: string; response_url?: string };
    if (!job.status_url) return { error: "video provider gave no job" };

    for (let i = 0; i < 45; i++) {
      await sleep(5000);
      const poll = await fetch(job.status_url, { headers });
      if (!poll.ok) continue;
      const state = (await poll.json()) as { status?: string };
      if (state.status === "COMPLETED") break;
      if (state.status === "FAILED") return { error: "video provider failed" };
    }
    const out = await fetch(job.response_url ?? job.status_url, { headers });
    if (!out.ok) return { error: "video not ready" };
    const json = (await out.json()) as { video?: { url?: string } };
    return json.video?.url ? { url: json.video.url } : { error: "video not ready" };
  } catch {
    return { error: "video provider unreachable" };
  }
}

async function lumaVideo(prompt: string): Promise<MediaResult> {
  const key = env("LUMA_API_KEY");
  if (!key) return { error: "not configured" };
  const headers = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  try {
    const create = await fetch("https://api.lumalabs.ai/dream-machine/v1/generations", {
      method: "POST",
      headers,
      body: JSON.stringify({ prompt, model: "ray-flash-2", resolution: "720p", duration: "5s" }),
    });
    if (!create.ok) return { error: `video provider ${create.status}` };
    const job = (await create.json()) as { id?: string };
    if (!job.id) return { error: "video provider gave no job" };
    for (let i = 0; i < 45; i++) {
      await sleep(5000);
      const poll = await fetch(`https://api.lumalabs.ai/dream-machine/v1/generations/${job.id}`, {
        headers,
      });
      if (!poll.ok) continue;
      const state = (await poll.json()) as {
        state?: string;
        assets?: { video?: string };
      };
      if (state.state === "failed") return { error: "video provider failed" };
      if (state.assets?.video) return { url: state.assets.video };
    }
    return { error: "video timed out" };
  } catch {
    return { error: "video provider unreachable" };
  }
}

async function builtInVideo(prompt: string, model?: string): Promise<MediaResult> {
  const key = LOVABLE();
  if (!key) return { error: "not configured" };
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
    if (!create.ok) return { error: `built-in video ${create.status}` };
    const job = (await create.json()) as { id: string };

    for (let i = 0; i < 40; i++) {
      await sleep(5000);
      const poll = await fetch(`https://ai.gateway.lovable.dev/v1/videos/${job.id}`, {
        headers: auth,
      });
      if (!poll.ok) continue;
      const state = (await poll.json()) as { status: string; error?: { message?: string } };
      if (state.status === "failed") return { error: state.error?.message ?? "built-in video failed" };
      if (state.status !== "completed") continue;

      const content = await fetch(`https://ai.gateway.lovable.dev/v1/videos/${job.id}/content`, {
        headers: auth,
      });
      if (!content.ok) return { error: "could not download video" };
      return { url: `data:video/mp4;base64,${toBase64(await content.arrayBuffer())}` };
    }
    return { error: "built-in video timed out" };
  } catch {
    return { error: "built-in video unreachable" };
  }
}

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

export async function generateVideo(prompt: string, model?: string): Promise<MediaResult> {
  // "reel" favours the higher-fidelity lane first; "motion" favours speed.
  const lanes =
    model === "reel"
      ? [() => falVideo(prompt), () => lumaVideo(prompt), () => builtInVideo(prompt, model)]
      : [() => lumaVideo(prompt), () => falVideo(prompt), () => builtInVideo(prompt, model)];
  let last = "no video provider configured";
  for (const lane of lanes) {
    const res = await lane();
    if (res.url) return { ...res, note: "Rendered a short clip." };
    if (res.error) last = res.error;
  }
  return { error: `Could not produce a video (${last}).` };
}

/* ── Voice (text to speech) ──────────────────────────────────────────── */

async function elevenVoice(text: string, model?: string): Promise<MediaResult> {
  const key = env("ELEVENLABS_API_KEY");
  if (!key) return { error: "not configured" };
  const voice = model === "echo" ? "CwhRBWXzGAHq8TQ4Fs17" : "EXAVITQu4vr4xnSDxMaL";
  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: { "xi-api-key": key, "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.slice(0, 2500), model_id: "eleven_multilingual_v2" }),
      },
    );
    if (!res.ok) return { error: `voice provider ${res.status}` };
    return { url: `data:audio/mpeg;base64,${toBase64(await res.arrayBuffer())}` };
  } catch {
    return { error: "voice provider unreachable" };
  }
}

async function sarvamVoice(text: string): Promise<MediaResult> {
  const key = env("SARVAM_API_KEY");
  if (!key) return { error: "not configured" };
  try {
    const res = await fetch("https://api.sarvam.ai/text-to-speech", {
      method: "POST",
      headers: { "api-subscription-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        text: text.slice(0, 1500),
        target_language_code: "en-IN",
        speaker: "anushka",
      }),
    });
    if (!res.ok) return { error: `voice provider ${res.status}` };
    const json = (await res.json()) as { audios?: string[] };
    const audio = json.audios?.[0];
    return audio ? { url: `data:audio/wav;base64,${audio}` } : { error: "empty voice response" };
  } catch {
    return { error: "voice provider unreachable" };
  }
}

async function builtInVoice(text: string): Promise<MediaResult> {
  const key = LOVABLE();
  if (!key) return { error: "not configured" };
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini-tts",
        input: text.slice(0, 2500),
        voice: "alloy",
        response_format: "mp3",
      }),
    });
    if (!res.ok) return { error: `built-in voice ${res.status}` };
    return { url: `data:audio/mpeg;base64,${toBase64(await res.arrayBuffer())}` };
  } catch {
    return { error: "built-in voice unreachable" };
  }
}

export async function generateVoice(text: string, model?: string): Promise<MediaResult> {
  const lanes = [
    () => elevenVoice(text, model),
    () => sarvamVoice(text),
    () => builtInVoice(text),
  ];
  let last = "no voice provider configured";
  for (const lane of lanes) {
    const res = await lane();
    if (res.url) return { ...res, note: "Voice ready." };
    if (res.error) last = res.error;
  }
  return { error: `Could not produce audio (${last}).` };
}
