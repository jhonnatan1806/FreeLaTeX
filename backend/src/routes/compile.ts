import type { FastifyInstance } from "fastify";
import { config, ENGINES, type Engine } from "../config.js";
import { runLatexmk } from "../compiler/latexmk.js";
import { Queue } from "../compiler/queue.js";
import { createWorkspace, normalizeProjectPath, WorkspaceError } from "../compiler/workspace.js";

const queue = new Queue(config.maxConcurrent);

function isEngine(value: string): value is Engine {
  return (ENGINES as readonly string[]).includes(value);
}

export async function compileRoutes(app: FastifyInstance) {
  app.post("/compile", async (req, reply) => {
    if (!req.isMultipart()) {
      return reply.code(415).send({ error: "Se esperaba multipart/form-data" });
    }

    let zip: Buffer | null = null;
    const fields: Record<string, string> = {};

    for await (const part of req.parts()) {
      if (part.type === "file") {
        if (part.fieldname === "project") {
          zip = await part.toBuffer();
        } else {
          await part.toBuffer(); // descartar archivos inesperados
        }
      } else if (typeof part.value === "string") {
        fields[part.fieldname] = part.value;
      }
    }

    if (!zip) return reply.code(400).send({ error: "Falta el archivo 'project' (zip)" });

    const mainFile = normalizeProjectPath(fields.mainFile ?? "");
    if (!mainFile || !mainFile.toLowerCase().endsWith(".tex")) {
      return reply.code(400).send({ error: "'mainFile' debe ser una ruta relativa a un .tex" });
    }

    const engine = fields.engine ?? "pdflatex";
    if (!isEngine(engine)) {
      return reply.code(400).send({ error: `'engine' debe ser uno de: ${ENGINES.join(", ")}` });
    }

    let workspace;
    try {
      workspace = await createWorkspace(zip);
    } catch (err) {
      if (err instanceof WorkspaceError) return reply.code(400).send({ error: err.message });
      throw err;
    }

    try {
      if (!workspace.files.includes(mainFile)) {
        return reply.code(400).send({ error: `El archivo principal '${mainFile}' no está en el zip` });
      }

      const result = await queue.run(() =>
        runLatexmk({ dir: workspace.dir, mainFile, engine, timeoutMs: config.timeoutMs }),
      );

      req.log.info(
        { id: workspace.id, engine, status: result.status, ms: result.durationMs },
        "compilación terminada",
      );

      return {
        status: result.status,
        exitCode: result.exitCode,
        pdf: result.pdf?.toString("base64") ?? null,
        log: result.log,
        synctex: result.synctex?.toString("base64") ?? null,
        output: result.output,
        durationMs: result.durationMs,
      };
    } finally {
      await workspace.cleanup();
    }
  });
}
