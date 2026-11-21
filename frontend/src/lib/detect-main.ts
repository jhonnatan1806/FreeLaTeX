import type { FileEntry } from "@/types/project";
import { basename, extname } from "./paths";

/** Quita comentarios LaTeX (% no escapado) de cada línea. */
export function stripComments(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      for (let i = 0; i < line.length; i++) {
        if (line[i] === "%") {
          // Contar barras invertidas previas: número impar => % escapado.
          let backslashes = 0;
          for (let j = i - 1; j >= 0 && line[j] === "\\"; j--) backslashes++;
          if (backslashes % 2 === 0) return line.slice(0, i);
        }
      }
      return line;
    })
    .join("\n");
}

const DOCUMENTCLASS = /\\documentclass\s*(\[[^\]]*\])?\s*\{[^}]+\}/;
const BEGIN_DOCUMENT = /\\begin\s*\{document\}/;

export function isRootDocument(text: string): boolean {
  return DOCUMENTCLASS.test(stripComments(text));
}

const PREFERRED_NAMES = ["main.tex", "tesis.tex", "thesis.tex", "paper.tex", "article.tex", "document.tex", "report.tex"];

function score(file: FileEntry): number {
  const name = basename(file.path).toLowerCase();
  const depth = file.path.split("/").length - 1;
  const clean = stripComments(file.text ?? "");
  let s = 0;
  const preferred = PREFERRED_NAMES.indexOf(name);
  if (preferred !== -1) s += 100 - preferred * 5;
  if (BEGIN_DOCUMENT.test(clean)) s += 50;
  s -= depth * 20;
  return s;
}

export interface MainDetection {
  /** El mejor candidato, o null si no hay ningún .tex con \documentclass. */
  mainFile: string | null;
  /** Todos los candidatos, ordenados del más al menos probable. */
  candidates: string[];
}

export function detectMainFile(files: FileEntry[]): MainDetection {
  const candidates = files
    .filter((f) => f.kind === "text" && extname(f.path) === ".tex" && isRootDocument(f.text ?? ""))
    .sort((a, b) => score(b) - score(a) || a.path.length - b.path.length || a.path.localeCompare(b.path))
    .map((f) => f.path);
  return { mainFile: candidates[0] ?? null, candidates };
}
