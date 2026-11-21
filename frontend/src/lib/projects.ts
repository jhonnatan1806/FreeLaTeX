import type { Engine, FileEntry, Project, ProjectFile } from "@/types/project";
import { db, fileId, type FreeLatexDB } from "./db";
import { detectMainFile } from "./detect-main";
import { readZip, writeZip, type ReadZipResult } from "./zip";

export const BLANK_TEMPLATE = String.raw`\documentclass[12pt]{article}
\usepackage[utf8]{inputenc}
\usepackage[T1]{fontenc}
\usepackage[spanish]{babel}
\usepackage{amsmath, amssymb}
\usepackage{graphicx}

\title{Mi documento}
\author{}
\date{\today}

\begin{document}

\maketitle

\section{Introducción}
Escribe aquí tu contenido.

\end{document}
`;

function newId(): string {
  return crypto.randomUUID();
}

function toProjectFile(projectId: string, entry: FileEntry, now: number): ProjectFile {
  return {
    id: fileId(projectId, entry.path),
    projectId,
    path: entry.path,
    kind: entry.kind,
    text: entry.kind === "text" ? entry.text : undefined,
    data: entry.kind === "binary" ? entry.data : undefined,
    size: entry.size,
    updatedAt: now,
  };
}

export async function createProject(
  input: { name: string; files: FileEntry[]; mainFile: string | null; engine?: Engine },
  database: FreeLatexDB = db,
): Promise<string> {
  const id = newId();
  const now = Date.now();
  const project: Project = {
    id,
    name: input.name.trim() || "Proyecto sin nombre",
    mainFile: input.mainFile,
    engine: input.engine ?? "pdflatex",
    createdAt: now,
    updatedAt: now,
  };
  await database.transaction("rw", database.projects, database.files, async () => {
    await database.projects.add(project);
    await database.files.bulkAdd(input.files.map((f) => toProjectFile(id, f, now)));
  });
  return id;
}

export function createBlankProject(name: string, database: FreeLatexDB = db): Promise<string> {
  const text = BLANK_TEMPLATE;
  return createProject(
    { name, mainFile: "main.tex", files: [{ path: "main.tex", kind: "text", text, size: text.length }] },
    database,
  );
}

export interface ZipAnalysis extends ReadZipResult {
  suggestedName: string;
  mainFile: string | null;
  candidates: string[];
}

/** Lee un zip y propone nombre y archivo principal, sin guardar nada. */
export function analyzeZip(fileName: string, bytes: Uint8Array): ZipAnalysis {
  const result = readZip(bytes);
  if (result.entries.length === 0) throw new Error("El ZIP no contiene archivos de proyecto");
  const { mainFile, candidates } = detectMainFile(result.entries);
  const fromFile = fileName.replace(/\.zip$/i, "").trim();
  return { ...result, suggestedName: fromFile || result.strippedRoot || "Proyecto importado", mainFile, candidates };
}

export async function renameProject(id: string, name: string, database: FreeLatexDB = db) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("El nombre no puede estar vacío");
  await database.projects.update(id, { name: trimmed, updatedAt: Date.now() });
}

export async function updateProjectSettings(
  id: string,
  changes: Partial<Pick<Project, "mainFile" | "engine">>,
  database: FreeLatexDB = db,
) {
  await database.projects.update(id, { ...changes, updatedAt: Date.now() });
}

export async function deleteProject(id: string, database: FreeLatexDB = db) {
  await database.transaction("rw", database.projects, database.files, database.folders, async () => {
    await database.files.where("projectId").equals(id).delete();
    await database.folders.where("projectId").equals(id).delete();
    await database.projects.delete(id);
  });
}

export async function duplicateProject(id: string, database: FreeLatexDB = db): Promise<string> {
  const project = await database.projects.get(id);
  if (!project) throw new Error("Proyecto no encontrado");
  const files = await getProjectFiles(id, database);
  return createProject(
    { name: `${project.name} (copia)`, mainFile: project.mainFile, engine: project.engine, files },
    database,
  );
}

export async function getProjectFiles(projectId: string, database: FreeLatexDB = db): Promise<ProjectFile[]> {
  const files = await database.files.where("projectId").equals(projectId).toArray();
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

export async function exportProjectZip(
  id: string,
  database: FreeLatexDB = db,
): Promise<{ filename: string; bytes: Uint8Array }> {
  const project = await database.projects.get(id);
  if (!project) throw new Error("Proyecto no encontrado");
  const files = await getProjectFiles(id, database);
  const safeName = project.name.replace(/[\\/:*?"<>|]+/g, "_").trim() || "proyecto";
  return { filename: `${safeName}.zip`, bytes: writeZip(files) };
}

/** Descarga bytes como archivo en el navegador. */
export function downloadBytes(filename: string, bytes: Uint8Array, type = "application/zip") {
  const blob = new Blob([bytes as BlobPart], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
