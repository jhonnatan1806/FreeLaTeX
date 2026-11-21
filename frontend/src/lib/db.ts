import Dexie, { type EntityTable } from "dexie";
import type { Project, ProjectFile, ProjectFolder } from "@/types/project";

export class FreeLatexDB extends Dexie {
  projects!: EntityTable<Project, "id">;
  files!: EntityTable<ProjectFile, "id">;
  folders!: EntityTable<ProjectFolder, "id">;

  constructor(name = "freelatex") {
    super(name);
    this.version(1).stores({
      projects: "id, updatedAt",
      files: "id, projectId, [projectId+path]",
      folders: "id, projectId",
    });
  }
}

export const db = new FreeLatexDB();

export function fileId(projectId: string, path: string): string {
  return `${projectId}/${path}`;
}
