import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";
import type { Engine } from "../config.js";

const ENGINE_FLAG: Record<Engine, string> = {
  pdflatex: "-pdf",
  xelatex: "-xelatex",
  lualatex: "-lualatex",
};

/** Máximo de salida de consola que se guarda (stdout + stderr). */
const MAX_OUTPUT_CHARS = 200_000;

export type CompileStatus = "success" | "error" | "timeout";

export interface CompileResult {
  status: CompileStatus;
  exitCode: number | null;
  pdf: Buffer | null;
  log: string | null;
  synctex: Buffer | null;
  /** Salida de consola de latexmk (útil cuando no se generó .log). */
  output: string;
  durationMs: number;
}

export interface CompileOptions {
  /** Directorio del workspace. */
  dir: string;
  /** Archivo principal relativo al workspace, p. ej. "tesis/main.tex". */
  mainFile: string;
  engine: Engine;
  timeoutMs: number;
}

async function readIfExists(path: string): Promise<Buffer | null> {
  try {
    return await readFile(path);
  } catch {
    return null;
  }
}

export async function runLatexmk(opts: CompileOptions): Promise<CompileResult> {
  const started = Date.now();
  const mainPath = join(opts.dir, ...opts.mainFile.split("/"));

  const args = [
    // No leer ningún latexmkrc: son código Perl y el proyecto podría traer uno.
    "-norc",
    ENGINE_FLAG[opts.engine],
    // Compilar desde la carpeta del archivo principal (rutas relativas a él).
    "-cd",
    // Seguir aunque haya errores para obtener PDF parcial y log completo.
    "-f",
    "-interaction=nonstopmode",
    "-file-line-error",
    "-synctex=1",
    "-latexoption=-no-shell-escape",
    mainPath,
  ];

  const isWindows = process.platform === "win32";
  const child = spawn("latexmk", args, {
    cwd: opts.dir,
    // En Linux creamos un grupo de procesos para poder matar a todos los hijos.
    detached: !isWindows,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, max_print_line: "10000" },
  });

  let output = "";
  const append = (chunk: Buffer) => {
    if (output.length < MAX_OUTPUT_CHARS) output += chunk.toString("utf8");
  };
  child.stdout.on("data", append);
  child.stderr.on("data", append);

  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    try {
      if (!isWindows && child.pid) process.kill(-child.pid, "SIGKILL");
      else child.kill("SIGKILL");
    } catch {
      // el proceso ya terminó
    }
  }, opts.timeoutMs);

  const exitCode = await new Promise<number | null>((resolveExit) => {
    child.on("error", (err) => {
      output += `\n[freelatex] No se pudo ejecutar latexmk: ${err.message}\n`;
      resolveExit(null);
    });
    child.on("close", (code) => resolveExit(code));
  });
  clearTimeout(timer);

  const outDir = dirname(mainPath);
  const base = basename(mainPath, extname(mainPath));
  const [pdf, logBuf, synctex] = await Promise.all([
    readIfExists(join(outDir, `${base}.pdf`)),
    readIfExists(join(outDir, `${base}.log`)),
    readIfExists(join(outDir, `${base}.synctex.gz`)),
  ]);

  let status: CompileStatus;
  if (timedOut) status = "timeout";
  else if (exitCode === 0 && pdf) status = "success";
  else status = "error";

  return {
    status,
    exitCode,
    pdf,
    // Los .log de TeX son bytes en la codificación de la entrada; latin1 nunca falla.
    log: logBuf ? logBuf.toString("latin1") : null,
    synctex,
    output: output.slice(0, MAX_OUTPUT_CHARS),
    durationMs: Date.now() - started,
  };
}
