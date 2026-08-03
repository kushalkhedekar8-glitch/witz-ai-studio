export type StudioModel = {
  id: string;
  name: string;
  tagline: string;
  badge: string;
  /** Tailwind-friendly glow accent color (oklch string). */
  glow: string;
};

/** Public catalog — branded names only, no underlying vendor/model names. */
export const STUDIO_MODELS: StudioModel[] = [
  {
    id: "cortex",
    name: "Cortex",
    tagline: "Balanced reasoning, built in",
    badge: "Included",
    glow: "oklch(0.85 0.15 195)",
  },
  {
    id: "nova",
    name: "Nova",
    tagline: "Fast drafts and iteration",
    badge: "Fast",
    glow: "oklch(0.78 0.19 330)",
  },
  {
    id: "quartz",
    name: "Quartz",
    tagline: "Precise code generation",
    badge: "Code",
    glow: "oklch(0.85 0.19 145)",
  },
  {
    id: "atlas",
    name: "Atlas",
    tagline: "Deep multi-step analysis",
    badge: "Deep",
    glow: "oklch(0.72 0.19 285)",
  },
  {
    id: "custom",
    name: "Your Key",
    tagline: "Bring your own API key",
    badge: "BYOK",
    glow: "oklch(0.85 0.18 85)",
  },
];

export const DEFAULT_MODEL = "cortex";
