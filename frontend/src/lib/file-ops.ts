import type { FileEntry, ProjectFile, ProjectFolder } from "@/types/project";
import { db, fileId, type FreeLatexDB } from "./db";
import { basename, isValidName, normalizePath } from "./paths";
import { isWithin, joinPath, replacePrefix } from "./tree";
import { classify } from "./zip";

export class FileOpError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FileOpError";
  }
}

function folderId(projectId: string, path: string) {
  return `${projectId}/${path}`;
}

function requirePath(raw: string): string {
  const path = normalizePath(raw);
  if (!path || !path.split("/").every(isValidName)) throw new FileOpError(`Nombre no válido: "${raw}"`);
  return path;
}

async function touch(database: FreeLatexDB, projectId: string) {
  await database.projects.update(projectId, { updatedAt: Date.now() });
}

async function listAll(database: FreeLatexDB, projectId: string) {
  const [files, folders] = await Promise.all([
    database.files.where("projectId").equals(projectId).toArray(),
    database.folders.where("projectId").equals(projectId).toArray(),
  ]);
  return { files, folders };
}

/** ¿Existe ya un archivo o carpeta (explícita o deducida) en esa ruta? */
export async function pathExists(projectId: string, path: string, database: FreeLatexDB = db) {
  const { files, folders } = await listAll(database, projectId);
  return (
    files.some((f) => f.path === path || f.path.startsWith(`${path}/`)) ||
    folders.some((f) => f.path === path || f.path.startsWith(`${path}/`))
  );
}

/** Falla si algún antecesor de la ruta es un archivo (p. ej. crear "main.tex/x"). */
async function assertParentsAreFolders(database: FreeLatexDB, projectId: string, path: string) {
  const parts = path.split("/");
  for (let i = 1; i < parts.length; i++) {
    const parent = parts.slice(0, i).join("/");
    if (await database.files.get(fileId(projectId, parent))) {
      throw new FileOpError(`"${parent}" es un archivo, no una carpeta`);
    }
  }
}

export async function createFile(projectId: string, rawPath: string, text = "", database: FreeLatexDB = db) {
  const path = requirePath(rawPath);
  if (await pathExists(projectId, path, database)) throw new FileOpError(`Ya existe "${path}"`);
  await assertParentsAreFolders(database, projectId, path);
  const now = Date.now();
  await database.files.add({
    id: fileId(projectId, path),
    projectId,
    path,
    kind: "text",
    text,
    size: new TextEncoder().encode(text).byteLength,
    updatedAt: now,
  });
  await touch(database, projectId);
  return path;
}

export async function createFolder(projectId: string, rawPath: string, database: FreeLatexDB = db) {
  const path = requirePath(rawPath);
  if (await pathExists(projectId, path, database)) throw new FileOpError(`Ya existe "${path}"`);
  await assertParentsAreFolders(database, projectId, path);
  await database.folders.add({ id: folderId(projectId, path), projectId, path });
  await touch(database, projectId);
  return path;
}

export async function saveFileText(projectId: string, path: string, text: string, database: FreeLatexDB = db) {
  const now = Date.now();
  const updated = await database.files.update(fileId(projectId, path), {
    text,
    size: new TextEncoder().encode(text).byteLength,
    updatedAt: now,
  });
  if (updated === 0) throw new FileOpError(`No existe "${path}"`);
  await touch(database, projectId);
}

/**
 * Renombra o mueve un archivo o una carpeta (con todo su contenido).
 * Devuelve la nueva ruta. Actualiza el archivo principal si se ve afectado.
 */
export async function renamePath(projectId: string, from: string, rawTo: string, database: FreeLatexDB = db) {
  const to = requirePath(rawTo);
  if (to === from) return to;
  if (isWithin(to, from)) throw new FileOpError("No se puede mover una carpeta dentro de sí misma");

  return database.transaction("rw", database.files, database.folders, database.projects, async () => {
    const { files, folders } = await listAll(database, projectId);
    const movedFiles = files.filter((f) => isWithin(f.path, from));
    const movedFolders = folders.filter((f) => isWithin(f.path, from));
    if (movedFiles.length === 0 && movedFolders.length === 0) throw new FileOpError(`No existe "${from}"`);

    const occupied = files.some((f) => isWithin(f.path, to)) || folders.some((f) => isWithin(f.path, to));
    if (occupied) throw new FileOpError(`Ya existe "${to}"`);
    await assertParentsAreFolders(database, projectId, to);

    const now = Date.now();
    const newFiles: ProjectFile[] = movedFiles.map((f) => {
      const path = replacePrefix(f.path, from, to);
      return { ...f, id: fileId(projectId, path), path, updatedAt: now };
    });
    const newFolders: ProjectFolder[] = movedFolders.map((f) => {
      const path = replacePrefix(f.path, from, to);
      return { ...f, id: folderId(projectId, path), path };
    });

    await database.files.bulkDelete(movedFiles.map((f) => f.id));
    await database.folders.bulkDelete(movedFolders.map((f) => f.id));
    await database.files.bulkAdd(newFiles);
    await database.folders.bulkAdd(newFolders);

    const project = await database.projects.get(projectId);
    const changes: { updatedAt: number; mainFile?: string } = { updatedAt: now };
    if (project?.mainFile && isWithin(project.mainFile, from)) {
      changes.mainFile = replacePrefix(project.mainFile, from, to);
    }
    await database.projects.update(projectId, changes);
    return to;
  });
}

/** Mueve un archivo o carpeta dentro de `targetFolder` ("" = raíz). */
export function movePath(projectId: string, from: string, targetFolder: string, database: FreeLatexDB = db) {
  return renamePath(projectId, from, joinPath(targetFolder, basename(from)), database);
}

/** Elimina un archivo o una carpeta con todo su contenido. */
export async function deletePath(projectId: string, path: string, database: FreeLatexDB = db) {
  await database.transaction("rw", database.files, database.folders, database.projects, async () => {
    const { files, folders } = await listAll(database, projectId);
    await database.files.bulkDelete(files.filter((f) => isWithin(f.path, path)).map((f) => f.id));
    await database.folders.bulkDelete(folders.filter((f) => isWithin(f.path, path)).map((f) => f.id));
    const project = await database.projects.get(projectId);
    const changes: { updatedAt: number; mainFile?: null } = { updatedAt: Date.now() };
    if (project?.mainFile && isWithin(project.mainFile, path)) changes.mainFile = null;
    await database.projects.update(projectId, changes);
  });
}

/**
 * Añade archivos subidos a una carpeta. Si ya existe un archivo con la misma
 * ruta se reemplaza. Devuelve las rutas escritas.
 */
export async function addEntries(
  projectId: string,
  targetFolder: string,
  entries: FileEntry[],
  database: FreeLatexDB = db,
): Promise<string[]> {
  const now = Date.now();
  const written: ProjectFile[] = [];
  for (const e of entries) {
    const path = requirePath(joinPath(targetFolder, e.path));
    await assertParentsAreFolders(database, projectId, path);
    const folderClash = await database.folders.get(folderId(projectId, path));
    if (folderClash) throw new FileOpError(`"${path}" ya es una carpeta`);
    written.push({
      id: fileId(projectId, path),
      projectId,
      path,
      kind: e.kind,
      text: e.kind === "text" ? e.text : undefined,
      data: e.kind === "binary" ? e.data : undefined,
      size: e.size,
      updatedAt: now,
    });
  }
  await database.files.bulkPut(written);
  await touch(database, projectId);
  return written.map((f) => f.path);
}

/** Convierte File del navegador (input o arrastre) en entradas del proyecto. */
export async function filesToEntries(files: { name: string; relativePath?: string; arrayBuffer(): Promise<ArrayBuffer> }[]) {
  const entries: FileEntry[] = [];
  for (const f of files) {
    const path = normalizePath(f.relativePath || f.name);
    if (!path) continue;
    entries.push(classify(path, new Uint8Array(await f.arrayBuffer())));
  }
  return entries;
}
