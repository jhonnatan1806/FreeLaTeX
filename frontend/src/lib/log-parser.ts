import { dirname } from "./paths";

export type LogLevel = "error" | "warning" | "typesetting";

export interface LogEntry {
  level: LogLevel;
  message: string;
  /** Ruta dentro del proyecto, o null si no se pudo asociar a un archivo del proyecto. */
  file: string | null;
  /** Nombre del archivo tal como aparece en el log (para mostrarlo aunque no sea del proyecto). */
  rawFile: string | null;
  line: number | null;
  /** Líneas de contexto del log (p. ej. "l.12 \textbf{..."). */
  context: string;
}

export interface ParseOptions {
  /** Archivo principal (las rutas del log son relativas a su carpeta). */
  mainFile: string;
  /** Si se da, solo se asocian rutas que existan en el proyecto. */
  projectFiles?: Set<string>;
}

/** Rutas absolutas del workspace del compilador: /tmp/freelatex/<uuid>/... */
const WORKSPACE_PATH = /\/freelatex\/[0-9a-f-]{36}\/(.+)$/;

/** Convierte una ruta del log en ruta del proyecto. */
export function resolveLogPath(raw: string, mainFile: string): string | null {
  const clean = raw.replace(/^"|"$/g, "");
  if (clean.startsWith("/")) {
    const m = WORKSPACE_PATH.exec(clean);
    return m ? m[1] : null; // archivo del sistema (TeX Live)
  }
  const relative = clean.replace(/^(\.\/)+/, "");
  const parts = [...(dirname(mainFile) ? dirname(mainFile).split("/") : []), ...relative.split("/")];
  const out: string[] = [];
  for (const part of parts) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      if (out.length === 0) return null;
      out.pop();
    } else out.push(part);
  }
  return out.join("/") || null;
}

const FILE_LINE_ERROR = /^((?:\.{0,2}\/)?[^\s:()]+\.[A-Za-z0-9]+):(\d+): (.*)$/;
const WARNING = /^(LaTeX(?: Font)?|Package [^\s]+|Class [^\s]+|pdfTeX)\s+warning:?\s*(.*)$/i;
const BOX = /^(Over|Under)full \\[hv]box\b.*?(?:lines? (\d+)(?:--\d+)?|line (\d+))/;
const INPUT_LINE = /on input line (\d+)/;
const L_LINE = /^l\.(\d+)/;
const PAREN_FILE = /^\(("[^"]+"|[^\s()]+)/;
const BIBER = /^(?:\[\d+\]\s+)?(?:Utils\.pm:\d+>\s+)?(ERROR|WARN) - (.*)$/;

/** Mantiene la pila de archivos abiertos a partir de los paréntesis del log. */
class FileStack {
  private stack: (string | null)[] = [];
  /** Último archivo cerrado: TeX a veces cierra el archivo antes de informar del error. */
  private lastClosed: string | null = null;

  feed(line: string) {
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === "(") {
        const m = PAREN_FILE.exec(line.slice(i));
        const token = m?.[1];
        const looksLikeFile = !!token && (/^(\.{0,2}\/|"|\/)/.test(token) || /\.[A-Za-z0-9]{1,8}$/.test(token));
        this.stack.push(looksLikeFile ? token! : null);
        if (m && looksLikeFile) i += m[0].length - 1;
      } else if (ch === ")") {
        const closed = this.stack.pop();
        if (closed) this.lastClosed = closed;
      }
    }
  }

  current(): string | null {
    for (let i = this.stack.length - 1; i >= 0; i--) if (this.stack[i]) return this.stack[i];
    return null;
  }

  /** Para errores: el archivo abierto o, si no hay ninguno, el último cerrado. */
  currentOrLast(): string | null {
    return this.current() ?? this.lastClosed;
  }
}

/**
 * Analiza el .log de TeX (compilado con -file-line-error) y la salida de latexmk.
 * Devuelve errores, avisos y problemas de maquetación (overfull/underfull).
 */
export function parseLatexLog(log: string, opts: ParseOptions, output = ""): LogEntry[] {
  const lines = log.split(/\r?\n/);
  const files = new FileStack();
  const entries: LogEntry[] = [];

  const toEntry = (level: LogLevel, message: string, rawFile: string | null, line: number | null, context = ""): LogEntry => {
    let file = rawFile ? resolveLogPath(rawFile, opts.mainFile) : null;
    if (file && opts.projectFiles && !opts.projectFiles.has(file)) file = null;
    return { level, message: message.trim(), file, rawFile, line, context: context.trimEnd() };
  };

  /** Recoge el contexto de un error hasta la línea "l.N" (incluida la siguiente). */
  const collectContext = (start: number): { context: string; line: number | null; end: number } => {
    const ctx: string[] = [];
    let lineNo: number | null = null;
    let i = start;
    for (; i < lines.length && i < start + 12; i++) {
      const l = lines[i];
      const m = L_LINE.exec(l);
      ctx.push(l);
      if (m) {
        lineNo = Number(m[1]);
        if (i + 1 < lines.length && lines[i + 1].trim() !== "") ctx.push(lines[++i]);
        break;
      }
      if (FILE_LINE_ERROR.test(l) || l.startsWith("! ")) {
        ctx.pop();
        i--;
        break;
      }
    }
    // Saltar el texto de ayuda de TeX hasta la siguiente línea vacía.
    while (i + 1 < lines.length && lines[i + 1].trim() !== "") i++;
    return { context: ctx.join("\n"), line: lineNo, end: i };
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const fle = FILE_LINE_ERROR.exec(line);
    if (fle && !line.startsWith("(")) {
      const { context, end } = collectContext(i + 1);
      entries.push(toEntry("error", fle[3], fle[1], Number(fle[2]), context));
      i = end;
      continue;
    }

    if (line.startsWith("! ")) {
      const { context, line: lineNo, end } = collectContext(i + 1);
      entries.push(toEntry("error", line.slice(2), files.currentOrLast(), lineNo, context));
      i = end;
      continue;
    }

    const warn = WARNING.exec(line);
    if (warn) {
      // Mensajes multilínea: continúan con "(paquete)   ..." o hasta una línea vacía.
      let message = warn[2];
      while (i + 1 < lines.length && lines[i + 1].trim() !== "" && /^\(.*?\)\s+/.test(lines[i + 1])) {
        message += " " + lines[++i].replace(/^\(.*?\)\s+/, "");
      }
      const m = INPUT_LINE.exec(message);
      entries.push(toEntry("warning", message.replace(/\s+/g, " "), files.current(), m ? Number(m[1]) : null));
      continue;
    }

    const box = BOX.exec(line);
    if (box) {
      entries.push(toEntry("typesetting", line, files.current(), Number(box[2] ?? box[3])));
      // El contenido de la caja puede tener paréntesis que no son archivos: saltarlo.
      while (i + 1 < lines.length && lines[i + 1].trim() !== "") i++;
      continue;
    }

    files.feed(line);
  }

  // Errores y avisos de biber en la salida de latexmk.
  for (const l of output.split(/\r?\n/)) {
    const m = BIBER.exec(l.trim());
    if (m) entries.push(toEntry(m[1] === "ERROR" ? "error" : "warning", `biber: ${m[2]}`, null, null));
  }

  // "Emergency stop" y "Fatal error" solo aportan si no hay otros errores.
  const generic = /^(Emergency stop|\s*==> Fatal error occurred)/;
  const hasSpecific = entries.some((e) => e.level === "error" && !generic.test(e.message));
  const filtered = hasSpecific ? entries.filter((e) => !(e.level === "error" && generic.test(e.message))) : entries;

  // Quitar duplicados exactos (p. ej. avisos repetidos).
  const seen = new Set<string>();
  return filtered.filter((e) => {
    const key = `${e.level}|${e.file ?? e.rawFile}|${e.line}|${e.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function countByLevel(entries: LogEntry[]) {
  return {
    errors: entries.filter((e) => e.level === "error").length,
    warnings: entries.filter((e) => e.level === "warning").length,
    typesetting: entries.filter((e) => e.level === "typesetting").length,
  };
}
