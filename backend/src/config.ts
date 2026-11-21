import { tmpdir } from "node:os";
import { join } from "node:path";

function int(name: string, fallback: number): number {
  const raw = process.env[name];
  const value = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export const ENGINES = ["pdflatex", "xelatex", "lualatex"] as const;
export type Engine = (typeof ENGINES)[number];

export const config = {
  host: process.env.HOST ?? "0.0.0.0",
  port: int("PORT", 4000),
  /** Orígenes permitidos para CORS, separados por coma. "*" permite todos. */
  corsOrigin: (process.env.CORS_ORIGIN ?? "http://localhost:3000")
    .split(",")
    .map((o) => o.trim()),
  /** Tamaño máximo del zip subido. */
  maxUploadBytes: int("MAX_UPLOAD_MB", 50) * 1024 * 1024,
  /** Tamaño máximo total descomprimido (protección contra zip bombs). */
  maxUnzippedBytes: int("MAX_UNZIPPED_MB", 200) * 1024 * 1024,
  /** Número máximo de archivos dentro del zip. */
  maxFiles: int("MAX_FILES", 2000),
  /** Tiempo máximo de una compilación. */
  timeoutMs: int("COMPILE_TIMEOUT_SECONDS", 60) * 1000,
  /** Compilaciones simultáneas; el resto espera en cola. */
  maxConcurrent: int("MAX_CONCURRENT_COMPILES", 2),
  /** Directorio donde se crean los espacios de trabajo temporales. */
  workRoot: process.env.WORK_ROOT ?? join(tmpdir(), "freelatex"),
};
