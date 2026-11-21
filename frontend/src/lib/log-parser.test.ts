import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { countByLevel, parseLatexLog, resolveLogPath } from "./log-parser";

const fixture = (name: string) => readFileSync(join(__dirname, "__fixtures__", name), "utf8");

describe("resolveLogPath", () => {
  it("rutas relativas a la carpeta del principal", () => {
    expect(resolveLogPath("./capitulos/uno.tex", "main.tex")).toBe("capitulos/uno.tex");
    expect(resolveLogPath("./figuras/tabla.tex", "tesis/main.tex")).toBe("tesis/figuras/tabla.tex");
    expect(resolveLogPath("../comun/a.tex", "tesis/main.tex")).toBe("comun/a.tex");
    expect(resolveLogPath("main.tex", "main.tex")).toBe("main.tex");
  });
  it("rutas absolutas", () => {
    expect(resolveLogPath("/usr/share/texlive/texmf-dist/tex/latex/base/article.cls", "main.tex")).toBeNull();
    expect(resolveLogPath("/tmp/freelatex/0b9c1e2a-1111-2222-3333-444455556666/cap/a.tex", "x/main.tex")).toBe(
      "cap/a.tex",
    );
    expect(resolveLogPath("../../fuera.tex", "main.tex")).toBeNull();
  });
});

describe("parseLatexLog: avisos.log", () => {
  const entries = parseLatexLog(fixture("avisos.log"), { mainFile: "main.tex" });

  it("errores con archivo y línea (incluido un archivo con \\input)", () => {
    const errors = entries.filter((e) => e.level === "error");
    expect(errors.map((e) => [e.file, e.line, e.message])).toEqual([
      ["secciones/dos.tex", 4, "Undefined control sequence."],
      ["main.tex", 12, "Missing $ inserted."],
    ]);
    expect(errors[0].context).toContain("l.4 Aquí hay un error: \\comandoquenoexiste");
  });

  it("avisos de referencias y citas con su línea", () => {
    const warnings = entries.filter((e) => e.level === "warning");
    expect(warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ file: "main.tex", line: 9, message: expect.stringContaining("Reference `sec:noexiste'") }),
        expect.objectContaining({ file: "main.tex", line: 9, message: expect.stringContaining("Citation `nadie2020'") }),
        expect.objectContaining({ message: "There were undefined references." }),
      ]),
    );
  });

  it("overfull hbox en main.tex", () => {
    const boxes = entries.filter((e) => e.level === "typesetting");
    expect(boxes).toHaveLength(1);
    expect(boxes[0]).toMatchObject({ file: "main.tex", line: 13 });
    expect(boxes[0].message).toMatch(/^Overfull \\hbox/);
  });
});

describe("parseLatexLog: con-error.log (sin línea)", () => {
  it("asocia el error al archivo abierto y omite los genéricos", () => {
    const entries = parseLatexLog(fixture("con-error.log"), { mainFile: "main.tex" });
    const errors = entries.filter((e) => e.level === "error");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ file: "main.tex", message: "File ended while scanning use of \\textbf ." });
  });
});

describe("parseLatexLog: principal en subcarpeta", () => {
  it("no hay errores y las rutas se resuelven desde tesis/", () => {
    const entries = parseLatexLog(fixture("subcarpeta.log"), { mainFile: "tesis/main.tex" });
    expect(countByLevel(entries).errors).toBe(0);
    for (const e of entries) if (e.file) expect(e.file.startsWith("tesis/")).toBe(true);
  });
});

describe("parseLatexLog: basico.log", () => {
  it("sin errores; avisos de paquete multilínea unidos", () => {
    const entries = parseLatexLog(fixture("basico.log"), { mainFile: "main.tex" });
    expect(countByLevel(entries).errors).toBe(0);
    const csquotes = entries.find((e) => e.message.includes("csquotes"));
    expect(csquotes?.level).toBe("warning");
    expect(csquotes?.message).not.toContain("(biblatex)");
  });
});

describe("parseLatexLog: casos sintéticos", () => {
  it("filtra archivos que no son del proyecto si se da la lista", () => {
    const log = "(./main.tex\n./main.aux:3: Something wrong.\n)";
    const [entry] = parseLatexLog(log, { mainFile: "main.tex", projectFiles: new Set(["main.tex"]) });
    expect(entry).toMatchObject({ file: null, rawFile: "./main.aux", line: 3 });
  });

  it("errores de biber en la salida de latexmk", () => {
    const entries = parseLatexLog("", { mainFile: "main.tex" }, "INFO - ok\nERROR - BibTeX subsystem: refs.bib, line 4, syntax error\nWARN - Duplicate entry key 'x'");
    expect(entries.map((e) => [e.level, e.message])).toEqual([
      ["error", "biber: BibTeX subsystem: refs.bib, line 4, syntax error"],
      ["warning", "biber: Duplicate entry key 'x'"],
    ]);
  });

  it("los paréntesis dentro de un overfull no rompen la pila de archivos", () => {
    const log = [
      "(./main.tex",
      "(./cap.tex",
      "Overfull \\hbox (5.0pt too wide) in paragraph at lines 3--4",
      "[]\\OT1/cmr/m/n/10 texto (con paréntesis",
      "",
      ")",
      "LaTeX Warning: Reference `a' on page 1 undefined on input line 7.",
    ].join("\n");
    const entries = parseLatexLog(log, { mainFile: "main.tex" });
    expect(entries.map((e) => [e.level, e.file, e.line])).toEqual([
      ["typesetting", "cap.tex", 3],
      ["warning", "main.tex", 7],
    ]);
  });
});
