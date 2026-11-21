import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { forwardSearch, parseSynctex, reverseSearch } from "./synctex";

const fixture = (name: string) => new Uint8Array(readFileSync(join(__dirname, "__fixtures__", name)));

describe("parseSynctex (principal en subcarpeta)", () => {
  const data = parseSynctex(fixture("subcarpeta.synctex.gz"), "tesis/main.tex");

  it("solo registros de archivos del proyecto, con rutas resueltas", () => {
    const files = new Set(data.records.map((r) => r.file));
    expect([...files].sort()).toEqual(["tesis/figuras/tabla.tex", "tesis/main.tex"]);
  });

  it("coordenadas en puntos PDF dentro de una página A4/carta", () => {
    for (const r of data.records) {
      expect(r.page).toBe(1);
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.x).toBeLessThan(620);
      expect(r.y).toBeLessThan(850);
    }
  });

  it("código → PDF: el párrafo de la línea 5 está bajo el título del capítulo (línea 4)", () => {
    const title = forwardSearch(data, "tesis/main.tex", 4)!;
    const paragraph = forwardSearch(data, "tesis/main.tex", 5)!;
    expect(title.page).toBe(1);
    expect(paragraph.page).toBe(1);
    expect(paragraph.rects[0].y).toBeGreaterThan(title.rects[0].y);
    // El margen izquierdo de "report" en carta es ~1in + algo.
    expect(paragraph.rects[0].x).toBeGreaterThan(72);
  });

  it("código → PDF en un archivo incluido", () => {
    const table = forwardSearch(data, "tesis/figuras/tabla.tex", 1);
    expect(table?.page).toBe(1);
    expect(table!.rects.length).toBeGreaterThan(0);
  });

  it("línea sin contenido: usa la más cercana", () => {
    expect(forwardSearch(data, "tesis/main.tex", 3)).not.toBeNull();
    expect(forwardSearch(data, "otro.tex", 1)).toBeNull();
  });

  it("ida y vuelta: el centro del rectángulo de una línea vuelve a esa línea", () => {
    for (const line of [4, 5]) {
      const { page, rects } = forwardSearch(data, "tesis/main.tex", line)!;
      const r = rects[0];
      expect(reverseSearch(data, page, r.x + 5, r.y + r.height / 2)).toEqual({ file: "tesis/main.tex", line });
    }
  });
});

describe("parseSynctex (varios archivos)", () => {
  const data = parseSynctex(fixture("basico.synctex.gz"), "main.tex");

  it("ida y vuelta en el capítulo incluido", () => {
    const fwd = forwardSearch(data, "capitulos/introduccion.tex", 2)!;
    expect(fwd).not.toBeNull();
    const r = fwd.rects[0];
    expect(reverseSearch(data, fwd.page, r.x + 5, r.y + r.height / 2)).toEqual({
      file: "capitulos/introduccion.tex",
      line: 2,
    });
  });

  it("clic fuera de cualquier caja devuelve el registro más cercano", () => {
    expect(reverseSearch(data, 1, 5, 5)).not.toBeNull();
    expect(reverseSearch(data, 99, 5, 5)).toBeNull();
  });
});
