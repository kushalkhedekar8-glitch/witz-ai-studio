import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const byokSchema = z
  .object({
    baseUrl: z.string().url().optional(),
    apiKey: z.string().min(8),
    model: z.string().min(1),
  })
  .optional();

const chatSchema = z.object({
  model: z.string(),
  messages: z.array(
    z.object({ role: z.enum(["user", "assistant", "system"]), content: z.string() }),
  ),
  byok: byokSchema,
});

const buildSchema = z.object({
  brief: z.string().min(3),
  engine: z.string(),
  byok: byokSchema,
  team: z.boolean(),
  withMockup: z.boolean(),
});

const taskSchema = buildSchema.extend({
  taskModels: z.object({ image: z.string(), video: z.string(), voice: z.string() }),
});

export const runStudio = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => chatSchema.parse(data))
  .handler(async ({ data }): Promise<{ text: string; error?: string }> => {
    const { chat, SYSTEM_PROMPT } = await import("./engines.server");
    return chat(
      data.model,
      [{ role: "system", content: SYSTEM_PROMPT }, ...data.messages],
      data.byok,
    );
  });

export const buildWithTeam = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => buildSchema.parse(data))
  .handler(async ({ data }) => {
    const { buildProject } = await import("./engines.server");
    return buildProject(data);
  });

/** Organizer-led entry point: one prompt in, the right specialist out. */
export const runTask = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => taskSchema.parse(data))
  .handler(async ({ data }) => {
    const { runOrganizedTask } = await import("./orchestrator.server");
    return runOrganizedTask(data);
  });
