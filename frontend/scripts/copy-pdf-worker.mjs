// Copia el worker de pdf.js a public/ para servirlo como archivo estático.
// Se ejecuta antes de `dev` y `build` (ver package.json).
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(dirname(require.resolve("pdfjs-dist/package.json")), "build", "pdf.worker.min.mjs");
const target = join(root, "public", "pdf.worker.min.mjs");

mkdirSync(dirname(target), { recursive: true });
copyFileSync(source, target);
