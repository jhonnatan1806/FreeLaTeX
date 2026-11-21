import { unzipSync, zipSync, type Unzipped } from "fflate";
import type { FileEntry, FileKind } from "@/types/project";
import { basename, extname, normalizePath } from "./paths";

/**
 * Extensiones que siempre son binarias. El resto se considera texto si su
 * contenido es UTF-8 válido.
 */
const BINARY_EXTENSIONS = new Set([
  ".pdf", ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".tif", ".tiff", ".webp", ".eps", ".ps",
  ".ttf", ".otf", ".woff", ".woff2", ".pfb", ".tfm", ".vf",
  ".zip", ".gz", ".tar", ".7z", ".docx", ".xlsx", ".pptx", ".mp4", ".mp3",
]);

/** Archivos generados por la compilación que no tiene sentido importar. */
const BUILD_EXTENSIONS = new Set([
  ".aux", ".log", ".out", ".toc", ".lof", ".lot", ".fls", ".fdb_latexmk", ".synctex",
  ".blg", ".bcf", ".xdv", ".nav", ".snm", ".vrb", ".idx", ".ilg", ".ind", ".glo", ".gls",
  ".glg", ".acn", ".acr", ".alg", ".run.xml",
]);

const IGNORED_DIRS = ["__MACOSX/", ".git/", ".svn/", ".vscode/", ".idea/"];
const IGNORED_NAMES = new Set([".DS_Store", "Thumbs.db", "desktop.ini"]);

export type SkipReason = "ignored" | "build" | "invalid-path";

export interface ReadZipResult {
  entries: FileEntry[];
  skipped: { path: string; reason: SkipReason }[];
  /** Carpeta raíz común que se quitó (p. ej. "mi-proyecto"), si la había. */
  strippedRoot: string | null;
}

function isBuildFile(path: string): boolean {
  const lower = path.toLowerCase();
  if (lower.endsWith(".synctex.gz") || lower.endsWith(".run.xml")) return true;
  return BUILD_EXTENSIONS.has(extname(path));
}

function isIgnored(path: string): boolean {
  if (IGNORED_DIRS.some((d) => path.startsWith(d) || path.includes(`/${d}`))) return true;
  return IGNORED_NAMES.has(basename(path));
}

const utf8 = new TextDecoder("utf-8", { fatal: true });

/** Devuelve el texto si los bytes son UTF-8 válido sin bytes nulos. */
function tryDecodeText(data: Uint8Array): string | null {
  if (data.subarray(0, 8000).includes(0)) return null;
  try {
    // Quitar BOM si existe.
    const text = utf8.decode(data);
    return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  } catch {
    return null;
  }
}

/**
 * Clasifica un archivo como texto o binario.
 * Un archivo "de texto" que no es UTF-8 válido (p. ej. latin1) se guarda como
 * binario para no alterar sus bytes: compila igual, pero no es editable.
 */
export function classify(path: string, data: Uint8Array): FileEntry {
  const ext = extname(path);
  let kind: FileKind = "binary";
  let text: string | null = null;
  if (!BINARY_EXTENSIONS.has(ext)) {
    // Extensiones de texto conocidas o desconocidas: texto si decodifica limpio.
    text = tryDecodeText(data);
    if (text !== null) kind = "text";
  }
  return kind === "text"
    ? { path, kind, text: text!, size: data.byteLength }
    : { path, kind, data, size: data.byteLength };
}

/** Si todas las rutas cuelgan de una misma carpeta, devuelve su nombre. */
export function commonRoot(paths: string[]): string | null {
  if (paths.length === 0) return null;
  const first = paths[0].split("/")[0];
  const allUnder = paths.every((p) => {
    const parts = p.split("/");
    return parts.length > 1 && parts[0] === first;
  });
  return allUnder ? first : null;
}

export function readZip(bytes: Uint8Array): ReadZipResult {
  let raw: Unzipped;
  try {
    raw = unzipSync(bytes);
  } catch {
    throw new Error("El archivo no es un ZIP válido");
  }

  const skipped: ReadZipResult["skipped"] = [];
  const kept: { path: string; data: Uint8Array }[] = [];

  for (const [name, data] of Object.entries(raw)) {
    if (name.endsWith("/")) continue; // entradas de carpeta
    const path = normalizePath(name);
    if (path === null) {
      skipped.push({ path: name, reason: "invalid-path" });
      continue;
    }
    if (isIgnored(path)) {
      skipped.push({ path, reason: "ignored" });
      continue;
    }
    kept.push({ path, data });
  }

  const root = commonRoot(kept.map((f) => f.path));
  const entries: FileEntry[] = [];
  for (const { path: fullPath, data } of kept) {
    const path = root ? fullPath.slice(root.length + 1) : fullPath;
    if (isBuildFile(path)) {
      skipped.push({ path, reason: "build" });
      continue;
    }
    entries.push(classify(path, data));
  }

  entries.sort((a, b) => a.path.localeCompare(b.path));
  return { entries, skipped, strippedRoot: root };
}

const utf8Encoder = new TextEncoder();

export function fileBytes(file: Pick<FileEntry, "kind" | "text" | "data">): Uint8Array {
  return file.kind === "text" ? utf8Encoder.encode(file.text ?? "") : (file.data ?? new Uint8Array());
}

/** Crea un zip con los archivos dados (rutas relativas). */
export function writeZip(files: Pick<FileEntry, "path" | "kind" | "text" | "data">[]): Uint8Array {
  const tree: Record<string, Uint8Array> = {};
  for (const f of files) tree[f.path] = fileBytes(f);
  return zipSync(tree, { level: 6 });
}
