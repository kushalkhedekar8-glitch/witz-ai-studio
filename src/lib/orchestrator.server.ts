/** Server-only orchestration: Organizer decides, one specialist runs. */

import { chat, buildProject, SYSTEM_PROMPT, type Byok } from "./engines.server";
import { organize, type TaskKind } from "./organizer.server";
import { generateVideo, generateVoice, sourceImage, searchWebImages } from "./media.server";
import type { BuildResult } from "./project";

export type TaskResult = {
  kind: TaskKind;
  reason: string;
  text?: string;
  media?: { kind: "image" | "video" | "audio"; url: string };
  note?: string;
  project?: BuildResult;
  error?: string;
};

export async function runOrganizedTask(opts: {
  brief: string;
  engine: string;
  byok?: Byok | undefined;
  team: boolean;
  withMockup: boolean;
  taskModels: { image: string; video: string; voice: string };
}): Promise<TaskResult> {
  const { brief, engine, byok, team, withMockup, taskModels } = opts;
  const plan = await organize(brief, byok);
  const base = { kind: plan.kind, reason: plan.reason } as const;

  if (plan.kind === "image") {
    const res = await sourceImage(plan.prompt, { model: taskModels.image });
    if (!res.url) return { ...base, error: res.error ?? "Could not produce an image." };
    return { ...base, media: { kind: "image", url: res.url }, ...(res.note ? { note: res.note } : {}) };
  }

  if (plan.kind === "video") {
    const res = await generateVideo(plan.prompt, taskModels.video);
    if (!res.url) return { ...base, error: res.error ?? "Could not produce a video." };
    return { ...base, media: { kind: "video", url: res.url }, ...(res.note ? { note: res.note } : {}) };
  }

  if (plan.kind === "voice") {
    const res = await generateVoice(plan.prompt, taskModels.voice);
    if (!res.url) return { ...base, error: res.error ?? "Could not produce audio." };
    return { ...base, media: { kind: "audio", url: res.url }, ...(res.note ? { note: res.note } : {}) };
  }

  if (plan.kind === "code") {
    // Reuse real photos from the internet when the build needs imagery.
    const images = plan.imageQueries.length ? await searchWebImages(plan.imageQueries) : [];
    const project = await buildProject({
      brief: plan.prompt,
      engine,
      byok,
      team,
      withMockup: withMockup && images.length === 0,
      images,
    });
    if (project.error) return { ...base, error: project.error };
    return {
      ...base,
      project,
      ...(images.length ? { note: `Reused ${images.length} image(s) found online.` } : {}),
    };
  }

  const res = await chat(
    engine,
    [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: plan.prompt },
    ],
    byok,
  );
  if (res.error) return { ...base, error: res.error };
  return { ...base, text: res.text };
}
