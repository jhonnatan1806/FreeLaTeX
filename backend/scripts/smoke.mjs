// Prueba rápida del compilador: comprime una carpeta y la envía a /compile.
//
//   node scripts/smoke.mjs <carpeta> <archivoPrincipal> [motor] [url]
//   node scripts/smoke.mjs ../examples/basico main.tex pdflatex
//
// Guarda el PDF y el log junto a la carpeta en ./smoke-output/.
import { readdirSync, readFileSync, statSync, mkdirSync, writeFileSync } from "node:fs";
import { join, relative, basename } from "node:path";
import { zipSync } from "fflate";

const [dir, mainFile, engine = "pdflatex", url = "http://localhost:4000"] = process.argv.slice(2);
if (!dir || !mainFile) {
  console.error("Uso: node scripts/smoke.mjs <carpeta> <archivoPrincipal> [motor] [url]");
  process.exit(2);
}

function collect(root, current = root, out = {}) {
  for (const name of readdirSync(current)) {
    const full = join(current, name);
    if (statSync(full).isDirectory()) collect(root, full, out);
    else out[relative(root, full).split("\\").join("/")] = readFileSync(full);
  }
  return out;
}

const zip = zipSync(collect(dir));
const form = new FormData();
form.append("project", new Blob([zip], { type: "application/zip" }), "project.zip");
form.append("mainFile", mainFile);
form.append("engine", engine);

const res = await fetch(`${url}/compile`, { method: "POST", body: form });
const body = await res.json();
if (!res.ok) {
  console.error(`HTTP ${res.status}:`, body);
  process.exit(1);
}

const outDir = join("smoke-output", basename(dir));
mkdirSync(outDir, { recursive: true });
if (body.pdf) writeFileSync(join(outDir, "output.pdf"), Buffer.from(body.pdf, "base64"));
if (body.log) writeFileSync(join(outDir, "output.log"), body.log);

const errors = (body.log ?? "").split("\n").filter((l) => /^(\S+:\d+:|! )/.test(l));
console.log(
  JSON.stringify(
    {
      status: body.status,
      exitCode: body.exitCode,
      durationMs: body.durationMs,
      pdfBytes: body.pdf ? Buffer.from(body.pdf, "base64").length : 0,
      synctex: Boolean(body.synctex),
      errors: errors.slice(0, 10),
      outDir,
    },
    null,
    2,
  ),
);
