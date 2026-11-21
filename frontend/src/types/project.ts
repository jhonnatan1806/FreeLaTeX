export const ENGINES = ["pdflatex", "xelatex", "lualatex"] as const;
export type Engine = (typeof ENGINES)[number];

export interface Project {
  id: string;
  name: string;
  /** Ruta del archivo principal, p. ej. "main.tex" o "tesis/main.tex". */
  mainFile: string | null;
  engine: Engine;
  createdAt: number;
  updatedAt: number;
}

export type FileKind = "text" | "binary";

export interface ProjectFile {
  /** `${projectId}/${path}` — único globalmente. */
  id: string;
  projectId: string;
  /** Ruta relativa normalizada con "/" (sin "/" inicial). */
  path: string;
  kind: FileKind;
  /** Contenido si kind === "text". */
  text?: string;
  /** Contenido si kind === "binary". */
  data?: Uint8Array;
  size: number;
  updatedAt: number;
}

/** Archivo en memoria antes de guardarlo (resultado de leer un zip). */
export interface FileEntry {
  path: string;
  kind: FileKind;
  text?: string;
  data?: Uint8Array;
  size: number;
}

export type CompileStatus = "success" | "error" | "timeout";

/** Resultado de una compilación. */
export interface CompileResult {
  status: CompileStatus;
  exitCode: number | null;
  pdf: Uint8Array | null;
  log: string | null;
  synctex: Uint8Array | null;
  /** Salida de consola de latexmk. */
  output: string;
  durationMs: number;
  compiledAt: number;
  engine: Engine;
  mainFile: string;
}

/** Último resultado guardado de un proyecto. */
export interface CompileOutput extends CompileResult {
  projectId: string;
}

/** Carpeta vacía explícita (el árbol también deduce carpetas de las rutas). */
export interface ProjectFolder {
  id: string;
  projectId: string;
  path: string;
}
