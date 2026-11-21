import { describe, expect, it } from "vitest";
import {
  buildIndex,
  extractBibEntries,
  extractCommands,
  extractEnvironments,
  extractLabels,
  relativeToMain,
} from "./latex-index";

describe("extractLabels", () => {
  it("encuentra etiquetas e ignora las comentadas", () => {
    expect(extractLabels("\\label{sec:a} x \\label{ eq:b }\n% \\label{no}")).toEqual(["sec:a", "eq:b"]);
  });
});

describe("extractBibEntries", () => {
  const bib = `
@string{acm = "ACM"}
@book{knuth1984,
  author    = {Donald E. Knuth},
  title     = {The {\\TeX}book},
  year      = 1984
}
@Article{ lamport94 ,
  title = "LaTeX: a document preparation system",
  year = {1994},
}
@comment{ignorar}`;

  it("claves, tipo y campos", () => {
    expect(extractBibEntries(bib)).toEqual([
      { key: "knuth1984", type: "book", author: "Donald E. Knuth", title: "The \\TeXbook", year: "1984" },
      { key: "lamport94", type: "article", author: undefined, title: "LaTeX: a document preparation system", year: "1994" },
    ]);
  });
});

describe("extractCommands / extractEnvironments", () => {
  it("newcommand con y sin llaves, con argumentos, DeclareMathOperator y def", () => {
    const tex = "\\newcommand{\\R}{\\mathbb{R}}\n\\renewcommand\\vec[1]{\\mathbf{#1}}\n\\DeclareMathOperator{\\sen}{sen}\n\\def\\foo{x}\n\\newcommand{\\@interno}{}";
    expect(extractCommands(tex)).toEqual([
      { name: "R", args: 0 },
      { name: "vec", args: 1 },
      { name: "sen", args: 0 },
      { name: "foo", args: 0 },
    ]);
  });
  it("entornos y teoremas", () => {
    expect(extractEnvironments("\\newenvironment{caja}{}{}\\newtheorem{teorema}{Teorema}")).toEqual(["caja", "teorema"]);
  });
});

describe("buildIndex", () => {
  it("combina archivos .tex y .bib", () => {
    const index = buildIndex([
      { path: "main.tex", text: "\\label{a}\\newcommand{\\x}{}" },
      { path: "refs.bib", text: "@misc{k1, title={T}}" },
      { path: "fig.png" },
    ]);
    expect(index.labels).toEqual([{ label: "a", file: "main.tex" }]);
    expect(index.bib.map((b) => b.key)).toEqual(["k1"]);
    expect(index.commands).toEqual([{ name: "x", args: 0 }]);
    expect(index.files).toEqual(["main.tex", "refs.bib", "fig.png"]);
  });
});

describe("relativeToMain", () => {
  it("rutas relativas a la carpeta del principal", () => {
    expect(relativeToMain("cap/uno.tex", "main.tex")).toBe("cap/uno.tex");
    expect(relativeToMain("tesis/cap/uno.tex", "tesis/main.tex")).toBe("cap/uno.tex");
    expect(relativeToMain("img/a.png", "tesis/main.tex")).toBe("../img/a.png");
  });
});
