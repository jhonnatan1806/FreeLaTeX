import type { FastifyInstance } from "fastify";
import { ENGINES } from "../config.js";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async () => ({ ok: true, engines: ENGINES }));
}
