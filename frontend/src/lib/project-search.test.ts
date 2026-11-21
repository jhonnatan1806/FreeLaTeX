import { describe, expect, it } from "vitest";
import { searchProject } from "./project-search";

const files = [
  { path: "main.tex", text: "\\section{Intro}\nTexto con Ecuación y ecuación.\n" },
  { path: "cap/a.tex", text: "una ecuación más" },
  { path: "fig.png" }, // binario: sin texto
];

describe("searchProject", () => {
  it("sin distinguir mayúsculas por defecto, ordenado por archivo", () => {
    const { matches } = searchProject(files, "ecuación");
    expect(matches.map((m) => `${m.path}:${m.line}:${m.start}`)).toEqual(["cap/a.tex:1:4", "main.tex:2:10", "main.tex:2:21"]);
    expect(matches[1].text.slice(matches[1].start, matches[1].end)).toBe("Ecuación");
  });

  it("distinguiendo mayúsculas", () => {
    expect(searchProject(files, "Ecuación", { caseSensitive: true }).matches).toHaveLength(1);
  });

  it("los caracteres especiales se buscan literalmente salvo en modo regex", () => {
    expect(searchProject(files, "\\section{").matches).toHaveLength(1);
    expect(searchProject(files, "\\\\sec\\w+", { regex: true }).matches[0].text).toBe("\\section{Intro}");
  });

  it("regex inválida devuelve error", () => {
    expect(searchProject(files, "(", { regex: true }).error).toBeTruthy();
  });

  it("respeta el límite y lo indica", () => {
    const r = searchProject(files, "e", { limit: 2 });
    expect(r.matches).toHaveLength(2);
    expect(r.truncated).toBe(true);
  });

  it("recorta líneas largas alrededor de la coincidencia", () => {
    const long = { path: "x.tex", text: `${"a".repeat(500)}AGUJA${"b".repeat(500)}` };
    const [m] = searchProject([long], "aguja").matches;
    expect(m.text.length).toBeLessThanOrEqual(201);
    expect(m.text.slice(m.start, m.end)).toBe("AGUJA");
  });
});
