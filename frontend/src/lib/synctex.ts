import { gunzipSync } from "fflate";
import { resolveLogPath } from "./log-parser";

/**
 * SyncTeX: relaciona posiciones del PDF con archivo y línea del código.
 * Todas las coordenadas se devuelven en puntos PDF (bp) con origen arriba a la izquierda.
 */

/** sp → bp: 65536 sp/pt × 72.27 pt/in ÷ 72 bp/in. */
const SP_PER_BP = 65781.76;

type Kind = "vbox" | "hbox" | "void" | "point" | "kern";

export interface SyncRecord {
  page: number;
  file: string;
  line: number;
  kind: Kind;
  x: number;
  y: number; // línea base
  width: number;
  height: number; // por encima de la línea base
  depth: number; // por debajo
}

export interface SyncData {
  records: SyncRecord[];
}

export interface PdfRect {
  x: number;
  y: number; // borde superior
  width: number;
  height: number;
}

// tipo, etiqueta, línea, [columna], x, y, [ancho, [alto, profundidad]]
const RECORD = /^([[(hvxkg$])(\d+),(\d+)(?:,-?\d+)?:(-?\d+),(-?\d+)(?::(-?\d+)(?:,(-?\d+),(-?\d+))?)?/;

const KIND: Record<string, Kind> = {
  "[": "vbox",
  "(": "hbox",
  h: "void",
  v: "void",
  k: "kern",
  x: "point",
  g: "point",
  $: "point",
};

export function parseSynctex(input: Uint8Array | string, mainFile: string): SyncData {
  const text =
    typeof input === "string"
      ? input
      : new TextDecoder().decode(input[0] === 0x1f && input[1] === 0x8b ? gunzipSync(input) : input);

  const files = new Map<number, string | null>();
  let unit = 1;
  let mag = 1;
  let xOffset = 0;
  let yOffset = 0;
  let page = 0;
  const records: SyncRecord[] = [];
  let inContent = false;

  for (const line of text.split("\n")) {
    if (!inContent) {
      if (line.startsWith("Input:")) {
        const m = /^Input:(\d+):(.*)$/.exec(line);
        if (m) files.set(Number(m[1]), resolveLogPath(m[2], mainFile));
      } else if (line.startsWith("Unit:")) unit = Number(line.slice(5)) || 1;
      else if (line.startsWith("Magnification:")) mag = (Number(line.slice(14)) || 1000) / 1000;
      else if (line.startsWith("X Offset:")) xOffset = Number(line.slice(9)) || 0;
      else if (line.startsWith("Y Offset:")) yOffset = Number(line.slice(9)) || 0;
      else if (line.startsWith("Content:")) inContent = true;
      continue;
    }

    const first = line[0];
    if (first === "{") {
      page = Number(line.slice(1));
      continue;
    }
    if (first === "}" || first === ")" || first === "]" || first === "!") continue;
    if (line.startsWith("Postamble:")) break;
    // Archivos abiertos durante el contenido (p. ej. con \input) también aparecen aquí.
    if (line.startsWith("Input:")) {
      const m = /^Input:(\d+):(.*)$/.exec(line);
      if (m) files.set(Number(m[1]), resolveLogPath(m[2], mainFile));
      continue;
    }

    const m = RECORD.exec(line);
    if (!m) continue;
    const file = files.get(Number(m[2]));
    if (!file) continue; // archivos de TeX Live o desconocidos

    const k = (v: string | undefined) => (v === undefined ? 0 : (Number(v) * unit * mag) / SP_PER_BP);
    records.push({
      page,
      file,
      line: Number(m[3]),
      kind: KIND[m[1]],
      x: k(m[4]) + (xOffset * unit * mag) / SP_PER_BP,
      y: k(m[5]) + (yOffset * unit * mag) / SP_PER_BP,
      width: Math.abs(k(m[6])),
      height: k(m[7]),
      depth: k(m[8]),
    });
  }
  return { records };
}

const hasArea = (r: SyncRecord) => (r.kind === "hbox" || r.kind === "void") && r.width > 0;

/** Registros "finos" (posición de texto): los que realmente indican qué línea del código se compuso ahí. */
const isFine = (r: SyncRecord) => r.kind === "point" || r.kind === "kern" || r.kind === "void";

/** Caja horizontal de línea que contiene la línea base `y` en `x` (cualquier archivo). */
function lineBoxAt(records: SyncRecord[], x: number, y: number): SyncRecord | undefined {
  return records
    .filter((r) => r.kind === "hbox" && Math.abs(r.y - y) < 0.5 && x >= r.x - 0.5 && x <= r.x + r.width + 0.5)
    .sort((a, b) => a.width - b.width)[0];
}

/**
 * Código → PDF: página y rectángulos que corresponden a una línea de un archivo.
 * Las cajas de línea de TeX se atribuyen a la línea donde termina el párrafo, así que
 * se usan los registros puntuales de la línea pedida, agrupados por línea base.
 */
export function forwardSearch(data: SyncData, file: string, line: number): { page: number; rects: PdfRect[] } | null {
  const inFile = data.records.filter((r) => r.file === file);
  if (inFile.length === 0) return null;

  // Línea exacta o, si no produjo nada visible, la más cercana con contenido.
  let candidates = inFile.filter((r) => r.line === line);
  if (candidates.length === 0) {
    const nearest = inFile.reduce((best, r) => (Math.abs(r.line - line) < Math.abs(best.line - line) ? r : best));
    candidates = inFile.filter((r) => r.line === nearest.line);
  }

  const page = Math.min(...candidates.map((r) => r.page));
  const onPage = candidates.filter((r) => r.page === page);
  const pageRecords = data.records.filter((r) => r.page === page);
  const fine = onPage.filter(isFine);
  const source = fine.length > 0 ? fine : onPage;

  // Agrupar por línea base.
  const groups = new Map<number, SyncRecord[]>();
  for (const r of source) {
    const key = Math.round(r.y * 2) / 2;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }

  const rects: PdfRect[] = [];
  for (const [y, group] of groups) {
    const left = Math.min(...group.map((r) => r.x));
    const right = Math.max(...group.map((r) => r.x + r.width));
    const box = lineBoxAt(pageRecords, left, y) ?? group.find((r) => r.kind === "hbox" || r.kind === "vbox");
    const sized = box && box.height + box.depth > 0;
    const height = sized ? box.height : 9;
    const depth = sized ? box.depth : 3;
    rects.push({ x: left, y: y - height, width: Math.max(right - left, 12), height: Math.max(height + depth, 4) });
  }
  rects.sort((a, b) => a.y - b.y);
  return { page, rects };
}

/** PDF → código: archivo y línea bajo un punto de una página. */
export function reverseSearch(data: SyncData, page: number, x: number, y: number): { file: string; line: number } | null {
  const onPage = data.records.filter((r) => r.page === page);
  if (onPage.length === 0) return null;

  // La caja horizontal más pequeña que contiene el punto.
  const containing = onPage
    .filter((r) => hasArea(r) && x >= r.x && x <= r.x + r.width && y >= r.y - r.height && y <= r.y + r.depth)
    .sort((a, b) => a.width * (a.height + a.depth) - b.width * (b.height + b.depth));
  if (containing.length > 0) {
    // Dentro de la caja, el registro puntual más cercano en esa línea visual afina la línea.
    // La caja de línea se atribuye al final del párrafo: afinar con el registro de texto
    // más cercano a la izquierda del clic en esa misma línea base.
    const box = containing[0];
    const sameLine = onPage.filter(
      (r) => isFine(r) && Math.abs(r.y - box.y) < 0.5 && r.x >= box.x - 0.5 && r.x <= box.x + box.width + 0.5,
    );
    const leftOf = sameLine.filter((r) => r.x <= x).sort((a, b) => b.x - a.x)[0];
    const best = leftOf ?? sameLine.sort((a, b) => a.x - b.x)[0] ?? box;
    return { file: best.file, line: best.line };
  }

  // Si no, el registro de texto más cercano.
  const nearest = onPage
    .filter(isFine)
    .reduce<SyncRecord | null>((best, r) => {
      const d = Math.hypot(r.x - x, r.y - y);
      return !best || d < Math.hypot(best.x - x, best.y - y) ? r : best;
    }, null);
  return nearest ? { file: nearest.file, line: nearest.line } : null;
}
