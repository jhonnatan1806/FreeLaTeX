import Dexie, { type EntityTable } from "dexie";
import type { CompileOutput, Project, ProjectFile, ProjectFolder } from "@/types/project";

export class FreeLatexDB extends Dexie {
  projects!: EntityTable<Project, "id">;
  files!: EntityTable<ProjectFile, "id">;
  folders!: EntityTable<ProjectFolder, "id">;
  /** Último resultado de compilación por proyecto (para mostrar el PDF al abrir). */
  outputs!: EntityTable<CompileOutput, "projectId">;

  constructor(name = "freelatex") {
    super(name);
    this.version(1).stores({
      projects: "id, updatedAt",
      files: "id, projectId, [projectId+path]",
      folders: "id, projectId",
    });
    this.version(2).stores({
      outputs: "projectId",
    });
  }
}

export const db = new FreeLatexDB();

export function fileId(projectId: string, path: string): string {
  return `${projectId}/${path}`;
}
