import type { CompileResult, CompileStatus, Engine } from "@/types/project";
import { COMPILER_URL } from "./config";
import { db, type FreeLatexDB } from "./db";
import { getProjectFiles } from "./projects";
import { writeZipAsync } from "./zip";

/** Error al preparar o enviar la compilación (no un error de LaTeX). */
export class CompileRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CompileRequestError";
  }
}

interface CompileResponse {
  status: CompileStatus;
  exitCode: number | null;
  pdf: string | null;
  log: string | null;
  synctex: string | null;
  output: string;
  durationMs: number;
}

export function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

interface CompileOptions {
  signal?: AbortSignal;
  database?: FreeLatexDB;
  url?: string;
  fetchImpl?: typeof fetch;
}

/** Empaqueta el proyecto desde IndexedDB y lo compila en el servidor. */
export async function compileProject(projectId: string, opts: CompileOptions = {}): Promise<CompileResult> {
  const database = opts.database ?? db;
  const doFetch = opts.fetchImpl ?? fetch;

  const project = await database.projects.get(projectId);
  if (!project) throw new CompileRequestError("Proyecto no encontrado");
  if (!project.mainFile) {
    throw new CompileRequestError("Elige el archivo principal (.tex) antes de compilar");
  }
  const mainFile = project.mainFile;
  const engine: Engine = project.engine;

  const files = await getProjectFiles(projectId, database);
  if (!files.some((f) => f.path === mainFile)) {
    throw new CompileRequestError(`El archivo principal "${mainFile}" no existe`);
  }

  const zip = await writeZipAsync(files);
  const form = new FormData();
  form.append("project", new Blob([zip as BlobPart], { type: "application/zip" }), "project.zip");
  form.append("mainFile", mainFile);
  form.append("engine", engine);

  let res: Response;
  try {
    res = await doFetch(`${opts.url ?? COMPILER_URL}/compile`, { method: "POST", body: form, signal: opts.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new CompileRequestError("No se pudo conectar con el compilador. ¿Está en marcha? (npm run compiler:up)");
  }

  if (!res.ok) {
    let message = `El compilador respondió ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // cuerpo no JSON
    }
    throw new CompileRequestError(message);
  }

  const body = (await res.json()) as CompileResponse;
  return {
    status: body.status,
    exitCode: body.exitCode,
    pdf: body.pdf ? base64ToBytes(body.pdf) : null,
    log: body.log,
    synctex: body.synctex ? base64ToBytes(body.synctex) : null,
    output: body.output ?? "",
    durationMs: body.durationMs,
    compiledAt: Date.now(),
    engine,
    mainFile,
  };
}
