export type ProjectType = "house" | "villa" | "resort" | "restaurant" | "commercial";
export type TimeOfDay = "morning" | "midday" | "sunset" | "night";

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  house:      "House",
  villa:      "Villa",
  resort:     "Resort",
  restaurant: "Restaurant",
  commercial: "Commercial",
};

export const PROJECT_TYPE_EMOJI: Record<ProjectType, string> = {
  house:      "🏠",
  villa:      "🏡",
  resort:     "🏖",
  restaurant: "🍽",
  commercial: "🏢",
};

export interface ProjectVersion {
  id: string;
  createdAt: number;
  /** Plain-language description of what changed in this version. */
  summary: string;
  houseConfigJson: string;
}

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  /** Categorises what's being built — drives which sidebar elements are available. */
  projectType: ProjectType;
  /** Raw JSON text driving procedural house generation for this project. */
  houseConfigJson: string;
  /** Permanent, append-only log of every AI edit. Never truncated or overwritten. */
  versions: ProjectVersion[];
  /** Index into `versions` the project is currently viewing — the undo/redo cursor. */
  currentVersionIndex: number;
  /** Visual time of day for the viewport sky and lighting. Persisted per project. */
  timeOfDay?: TimeOfDay;
}
