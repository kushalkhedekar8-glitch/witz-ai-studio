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
    glow: "oklch(0.72 0.19 265)",
  },
  {
    id: "nova",
    name: "Nova",
    tagline: "Fast drafts and iteration",
    badge: "Fast",
    glow: "oklch(0.70 0.22 300)",
  },
  {
    id: "quartz",
    name: "Quartz",
    tagline: "Precise code generation",
    badge: "Code",
    glow: "oklch(0.80 0.14 220)",
  },
  {
    id: "atlas",
    name: "Atlas",
    tagline: "Deep multi-step analysis",
    badge: "Deep",
    glow: "oklch(0.62 0.24 290)",
  },
  {
    id: "prism",
    name: "Prism",
    tagline: "Long context and vision",
    badge: "Context",
    glow: "oklch(0.78 0.16 240)",
  },
  {
    id: "custom",
    name: "Your Key",
    tagline: "Bring your own API key",
    badge: "BYOK",
    glow: "oklch(0.82 0.15 320)",
  },
];

export const DEFAULT_MODEL = "cortex";
