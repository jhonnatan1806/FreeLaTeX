import { describe, expect, it } from "vitest";
import { ancestors, buildTree, isWithin, replacePrefix, type TreeFolder } from "./tree";

const f = (path: string) => path;

function shape(folder: TreeFolder): unknown[] {
  return folder.children.map((n) => (n.type === "folder" ? { [n.name]: shape(n) } : n.name));
}

describe("buildTree", () => {
  it("carpetas primero, orden natural y carpetas deducidas", () => {
    const tree = buildTree([f("main.tex"), f("cap/cap10.tex"), f("cap/cap2.tex"), f("a.bib"), f("img/x/y.png")]);
    expect(shape(tree)).toEqual([{ cap: ["cap2.tex", "cap10.tex"] }, { img: [{ x: ["y.png"] }] }, "a.bib", "main.tex"]);
  });

  it("incluye carpetas vacías explícitas", () => {
    const tree = buildTree([f("main.tex")], ["vacia", "otra/sub"]);
    expect(shape(tree)).toEqual([{ otra: [{ sub: [] }] }, { vacia: [] }, "main.tex"]);
  });
});

describe("helpers de rutas", () => {
  it("ancestors", () => {
    expect(ancestors("a/b/c.tex")).toEqual(["a", "a/b"]);
    expect(ancestors("main.tex")).toEqual([]);
  });
  it("isWithin no confunde prefijos parciales", () => {
    expect(isWithin("cap/uno.tex", "cap")).toBe(true);
    expect(isWithin("capitulos/uno.tex", "cap")).toBe(false);
    expect(isWithin("x", "")).toBe(true);
  });
  it("replacePrefix", () => {
    expect(replacePrefix("cap/uno.tex", "cap", "capitulos")).toBe("capitulos/uno.tex");
    expect(replacePrefix("cap", "cap", "x/cap")).toBe("x/cap");
  });
});
