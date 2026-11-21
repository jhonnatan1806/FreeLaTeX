/**
 * Normaliza una ruta de proyecto: separadores "/", sin "./", sin "/" inicial.
 * Devuelve null si la ruta es inválida o intenta salir del proyecto.
 */
export function normalizePath(raw: string): string | null {
  const path = raw.replace(/\\/g, "/");
  if (/^[a-zA-Z]:/.test(path) || path.includes("\0")) return null;
  const segments = path.split("/").filter((s) => s !== "" && s !== ".");
  if (segments.length === 0 || segments.includes("..")) return null;
  return segments.join("/");
}

export function basename(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

export function dirname(path: string): string {
  const i = path.lastIndexOf("/");
  return i === -1 ? "" : path.slice(0, i);
}

export function extname(path: string): string {
  const name = basename(path);
  const i = name.lastIndexOf(".");
  return i <= 0 ? "" : name.slice(i).toLowerCase();
}

/** Caracteres no permitidos en un nombre de archivo o carpeta. */
const INVALID_NAME = /[\\/:*?"<>|\0]/;

export function isValidName(name: string): boolean {
  const trimmed = name.trim();
  return trimmed !== "" && trimmed !== "." && trimmed !== ".." && !INVALID_NAME.test(trimmed);
}
