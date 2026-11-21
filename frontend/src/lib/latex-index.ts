import { stripComments } from "./detect-main";
import { dirname, extname } from "./paths";

/** Etiquetas definidas con \label{...}. */
export function extractLabels(tex: string): string[] {
  const out: string[] = [];
  for (const m of stripComments(tex).matchAll(/\\label\s*\{([^{}]+)\}/g)) out.push(m[1].trim());
  return out;
}

export interface BibEntry {
  key: string;
  type: string;
  title?: string;
  author?: string;
  year?: string;
}

/** Entradas de un .bib (sin @string, @comment ni @preamble). */
export function extractBibEntries(bib: string): BibEntry[] {
  const out: BibEntry[] = [];
  const re = /@(\w+)\s*[{(]\s*([^,\s{}()]+)\s*,/g;
  const starts = [...bib.matchAll(re)];
  starts.forEach((m, i) => {
    const type = m[1].toLowerCase();
    if (type === "string" || type === "comment" || type === "preamble") return;
    const body = bib.slice(m.index! + m[0].length, starts[i + 1]?.index ?? bib.length);
    const field = (name: string) => {
      const f = new RegExp(`\\b${name}\\s*=\\s*(?:\\{((?:[^{}]|\\{[^{}]*\\})*)\\}|"([^"]*)"|(\\d+))`, "i").exec(body);
      const value = f?.[1] ?? f?.[2] ?? f?.[3];
      return value?.replace(/[{}]/g, "").replace(/\s+/g, " ").trim();
    };
    out.push({ key: m[2], type, title: field("title"), author: field("author"), year: field("year") });
  });
  return out;
}

export interface CommandDef {
  name: string;
  /** Número de argumentos obligatorios (si se puede deducir). */
  args: number;
}

/** Comandos definidos en el proyecto (\newcommand, \renewcommand, \DeclareMathOperator, \def). */
export function extractCommands(tex: string): CommandDef[] {
  const clean = stripComments(tex);
  const out: CommandDef[] = [];
  const re = /\\(?:re)?newcommand\*?\s*\{?\s*\\([a-zA-Z@]+)\s*\}?\s*(?:\[(\d)\])?/g;
  for (const m of clean.matchAll(re)) out.push({ name: m[1], args: m[2] ? Number(m[2]) : 0 });
  for (const m of clean.matchAll(/\\DeclareMathOperator\*?\s*\{\s*\\([a-zA-Z]+)\s*\}/g)) out.push({ name: m[1], args: 0 });
  for (const m of clean.matchAll(/\\def\s*\\([a-zA-Z@]+)/g)) out.push({ name: m[1], args: 0 });
  return out.filter((c) => !c.name.includes("@"));
}

/** Entornos definidos con \newenvironment / \newtheorem. */
export function extractEnvironments(tex: string): string[] {
  const clean = stripComments(tex);
  const out: string[] = [];
  for (const m of clean.matchAll(/\\(?:re)?newenvironment\s*\{([^{}]+)\}/g)) out.push(m[1].trim());
  for (const m of clean.matchAll(/\\newtheorem\*?\s*\{([^{}]+)\}/g)) out.push(m[1].trim());
  return out;
}

export interface ProjectIndex {
  labels: { label: string; file: string }[];
  bib: (BibEntry & { file: string })[];
  commands: CommandDef[];
  environments: string[];
  files: string[];
}

/** Índice del proyecto para el autocompletado. */
export function buildIndex(files: { path: string; text?: string }[]): ProjectIndex {
  const index: ProjectIndex = { labels: [], bib: [], commands: [], environments: [], files: [] };
  for (const f of files) {
    index.files.push(f.path);
    if (f.text === undefined) continue;
    const ext = extname(f.path);
    if (ext === ".bib") {
      for (const e of extractBibEntries(f.text)) index.bib.push({ ...e, file: f.path });
    } else if (ext === ".tex" || ext === ".sty" || ext === ".cls") {
      for (const label of extractLabels(f.text)) index.labels.push({ label, file: f.path });
      index.commands.push(...extractCommands(f.text));
      index.environments.push(...extractEnvironments(f.text));
    }
  }
  return index;
}

/**
 * Ruta tal como se escribe en \input / \includegraphics: relativa a la carpeta
 * del archivo principal (desde donde compila latexmk).
 */
export function relativeToMain(path: string, mainFile: string | null): string {
  const base = mainFile ? dirname(mainFile) : "";
  if (!base) return path;
  if (path.startsWith(`${base}/`)) return path.slice(base.length + 1);
  const up = base.split("/").length;
  return `${"../".repeat(up)}${path}`;
}
