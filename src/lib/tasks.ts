export type TaskModel = { id: string; name: string; tagline: string };

/** Public, branded specialist models the user can pick per kind of work. */
export const TASK_MODELS: Record<
  "image" | "video" | "voice",
  { label: string; options: TaskModel[] }
> = {
  image: {
    label: "Image",
    options: [
      { id: "canvas", name: "Canvas", tagline: "Balanced visuals" },
      { id: "aurora", name: "Aurora", tagline: "Highest detail" },
    ],
  },
  video: {
    label: "Video",
    options: [
      { id: "motion", name: "Motion", tagline: "Fast clips" },
      { id: "reel", name: "Reel", tagline: "Higher fidelity" },
    ],
  },
  voice: {
    label: "Voice",
    options: [
      { id: "vox", name: "Vox", tagline: "Warm narrator" },
      { id: "echo", name: "Echo", tagline: "Crisp presenter" },
    ],
  },
};

export type TaskModelChoice = { image: string; video: string; voice: string };

export const DEFAULT_TASK_MODELS: TaskModelChoice = {
  image: "canvas",
  video: "motion",
  voice: "vox",
};
