import { describe, expect, it } from "vitest";
import type { FileEntry } from "@/types/project";
import { detectMainFile, isRootDocument, stripComments } from "./detect-main";

const tex = (path: string, text: string): FileEntry => ({ path, kind: "text", text, size: text.length });
const DOC = "\\documentclass{article}\n\\begin{document}\nx\n\\end{document}";

describe("stripComments", () => {
  it("quita comentarios pero respeta \\%", () => {
    expect(stripComments("a % b")).toBe("a ");
    expect(stripComments("50\\% más % comentario")).toBe("50\\% más ");
    expect(stripComments("\\\\% comentario")).toBe("\\\\");
  });
});

describe("isRootDocument", () => {
  it("reconoce \\documentclass con y sin opciones", () => {
    expect(isRootDocument("\\documentclass{article}")).toBe(true);
    expect(isRootDocument("\\documentclass[12pt,a4paper]{report}")).toBe(true);
  });
  it("ignora \\documentclass comentado", () => {
    expect(isRootDocument("% \\documentclass{article}\n\\section{x}")).toBe(false);
  });
});

describe("detectMainFile", () => {
  it("devuelve null si no hay candidatos", () => {
    expect(detectMainFile([tex("cap1.tex", "\\section{A}")])).toEqual({ mainFile: null, candidates: [] });
  });

  it("prefiere main.tex en la raíz", () => {
    const r = detectMainFile([tex("otro.tex", DOC), tex("main.tex", DOC), tex("x/main.tex", DOC)]);
    expect(r.mainFile).toBe("main.tex");
    expect(r.candidates).toHaveLength(3);
  });

  it("encuentra el principal en una subcarpeta", () => {
    const r = detectMainFile([tex("tesis/tesis.tex", DOC), tex("tesis/cap1.tex", "\\chapter{x}")]);
    expect(r.mainFile).toBe("tesis/tesis.tex");
    expect(r.candidates).toEqual(["tesis/tesis.tex"]);
  });

  it("prefiere archivos con \\begin{document} frente a plantillas sueltas", () => {
    const r = detectMainFile([tex("plantilla.tex", "\\documentclass{article}"), tex("informe.tex", DOC)]);
    expect(r.mainFile).toBe("informe.tex");
  });

  it("ignora archivos binarios y no .tex", () => {
    const r = detectMainFile([
      { path: "a.tex", kind: "binary", data: new Uint8Array(), size: 0 },
      tex("notas.txt", DOC),
    ]);
    expect(r.mainFile).toBeNull();
  });
});
