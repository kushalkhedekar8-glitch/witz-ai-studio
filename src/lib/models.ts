export type StudioModel = {
  id: string;
  name: string;
  tagline: string;
  badge: string;
};

/** Public catalog — branded names only, no underlying vendor/model names. */
export const STUDIO_MODELS: StudioModel[] = [
  { id: "cortex", name: "Cortex", tagline: "Balanced reasoning, built in", badge: "Included" },
  { id: "nova", name: "Nova", tagline: "Fast drafts and iteration", badge: "Fast" },
  { id: "quartz", name: "Quartz", tagline: "Precise code generation", badge: "Code" },
  { id: "atlas", name: "Atlas", tagline: "Deep multi-step analysis", badge: "Deep" },
];

export const DEFAULT_MODEL = "cortex";
