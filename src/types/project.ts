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
  /** Raw JSON text driving procedural house generation for this project. */
  houseConfigJson: string;
  /** Permanent, append-only log of every AI edit. Never truncated or overwritten. */
  versions: ProjectVersion[];
  /** Index into `versions` the project is currently viewing — the undo/redo cursor. */
  currentVersionIndex: number;
}
