import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { mkdir } from "node:fs/promises";
import { config } from "./config.js";
import { compileRoutes } from "./routes/compile.js";
import { healthRoutes } from "./routes/health.js";

const app = Fastify({
  logger: true,
  // La respuesta incluye el PDF en base64; damos margen al cuerpo.
  bodyLimit: config.maxUploadBytes + 1024 * 1024,
});

await app.register(cors, {
  origin: config.corsOrigin.includes("*") ? true : config.corsOrigin,
});

await app.register(multipart, {
  limits: {
    fileSize: config.maxUploadBytes,
    files: 1,
    fields: 10,
  },
  throwFileSizeLimit: true,
});

app.setErrorHandler((err: Error & { statusCode?: number; code?: string }, req, reply) => {
  if (err.code === "FST_REQ_FILE_TOO_LARGE") {
    return reply.code(413).send({ error: "El zip supera el tamaño máximo permitido" });
  }
  const status = err.statusCode && err.statusCode < 500 ? err.statusCode : 500;
  if (status === 500) req.log.error(err);
  return reply.code(status).send({ error: status === 500 ? "Error interno" : err.message });
});

await app.register(healthRoutes);
await app.register(compileRoutes);

await mkdir(config.workRoot, { recursive: true });

const shutdown = async () => {
  await app.close();
  process.exit(0);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

await app.listen({ host: config.host, port: config.port });
