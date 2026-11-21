import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { unzipSync } from "fflate";
import { config } from "../config.js";

export class WorkspaceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkspaceError";
  }
}

/**
 * Normaliza una ruta relativa del proyecto ("a/b.tex").
 * Devuelve null si la ruta es peligrosa (absoluta, con "..", etc.).
 */
export function normalizeProjectPath(raw: string): string | null {
  const path = raw.replace(/\\/g, "/").replace(/^\.\/+/, "");
  if (path === "" || path.startsWith("/") || /^[a-zA-Z]:/.test(path)) return null;
  if (path.includes("\0")) return null;
  const segments = path.split("/").filter((s) => s !== "" && s !== ".");
  if (segments.length === 0 || segments.some((s) => s === "..")) return null;
  return segments.join("/");
}

function isIgnored(path: string): boolean {
  return path.startsWith("__MACOSX/") || path.split("/").pop() === ".DS_Store";
}

export interface Workspace {
  id: string;
  dir: string;
  files: string[];
  cleanup: () => Promise<void>;
}

/** Descomprime el zip del proyecto en un directorio temporal nuevo. */
export async function createWorkspace(zip: Uint8Array): Promise<Workspace> {
  let fileCount = 0;
  let declaredBytes = 0;

  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(zip, {
      filter(file) {
        if (file.name.endsWith("/")) return false; // directorios
        fileCount += 1;
        declaredBytes += file.originalSize;
        if (fileCount > config.maxFiles) {
          throw new WorkspaceError(`El zip tiene más de ${config.maxFiles} archivos`);
        }
        if (declaredBytes > config.maxUnzippedBytes) {
          throw new WorkspaceError("El proyecto descomprimido es demasiado grande");
        }
        return true;
      },
    });
  } catch (err) {
    if (err instanceof WorkspaceError) throw err;
    throw new WorkspaceError("El archivo no es un zip válido");
  }

  const id = randomUUID();
  const dir = resolve(config.workRoot, id);
  await mkdir(dir, { recursive: true });
  const cleanup = () => rm(dir, { recursive: true, force: true });

  try {
    const files: string[] = [];
    let realBytes = 0;
    for (const [rawName, data] of Object.entries(entries)) {
      const name = normalizeProjectPath(rawName);
      if (name === null) throw new WorkspaceError(`Ruta no permitida en el zip: ${rawName}`);
      if (isIgnored(name)) continue;

      realBytes += data.byteLength;
      if (realBytes > config.maxUnzippedBytes) {
        throw new WorkspaceError("El proyecto descomprimido es demasiado grande");
      }

      const target = join(dir, ...name.split("/"));
      // Defensa adicional: el destino debe quedar dentro del workspace.
      if (!target.startsWith(dir + sep)) {
        throw new WorkspaceError(`Ruta no permitida en el zip: ${rawName}`);
      }
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, data);
      files.push(name);
    }
    return { id, dir, files, cleanup };
  } catch (err) {
    await cleanup();
    throw err;
  }
}
