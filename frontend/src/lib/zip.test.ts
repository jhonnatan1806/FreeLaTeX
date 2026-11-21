import { describe, expect, it } from "vitest";
import { zipSync, strToU8 } from "fflate";
import { classify, commonRoot, readZip, writeZip } from "./zip";
import { normalizePath } from "./paths";

describe("normalizePath", () => {
  it("normaliza separadores y segmentos vacíos", () => {
    expect(normalizePath("a\\b//c.tex")).toBe("a/b/c.tex");
    expect(normalizePath("./main.tex")).toBe("main.tex");
    expect(normalizePath("/abs/main.tex")).toBe("abs/main.tex");
  });
  it("rechaza rutas que salen del proyecto", () => {
    expect(normalizePath("../evil.tex")).toBeNull();
    expect(normalizePath("a/../../b")).toBeNull();
    expect(normalizePath("C:/x.tex")).toBeNull();
    expect(normalizePath("")).toBeNull();
  });
});

describe("commonRoot", () => {
  it("detecta una carpeta raíz común", () => {
    expect(commonRoot(["p/main.tex", "p/img/a.png"])).toBe("p");
  });
  it("no quita nada si hay archivos en la raíz", () => {
    expect(commonRoot(["main.tex", "p/a.tex"])).toBeNull();
    expect(commonRoot(["a/main.tex", "b/x.tex"])).toBeNull();
  });
});

describe("classify", () => {
  it("texto UTF-8", () => {
    const f = classify("main.tex", strToU8("Hola ñandú"));
    expect(f.kind).toBe("text");
    expect(f.text).toBe("Hola ñandú");
  });
  it("quita el BOM", () => {
    const f = classify("a.tex", new Uint8Array([0xef, 0xbb, 0xbf, 0x41]));
    expect(f.text).toBe("A");
  });
  it("imágenes como binario", () => {
    expect(classify("fig.png", strToU8("abc")).kind).toBe("binary");
  });
  it(".tex en latin1 se conserva como binario", () => {
    const f = classify("viejo.tex", new Uint8Array([0x63, 0x61, 0x66, 0xe9])); // "café" latin1
    expect(f.kind).toBe("binary");
    expect(f.data).toEqual(new Uint8Array([0x63, 0x61, 0x66, 0xe9]));
  });
});

describe("readZip", () => {
  const zip = zipSync({
    "mi-proyecto/": new Uint8Array(),
    "mi-proyecto/main.tex": strToU8("\\documentclass{article}"),
    "mi-proyecto/img/logo.png": new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 1]),
    "mi-proyecto/main.aux": strToU8("aux"),
    "mi-proyecto/main.synctex.gz": new Uint8Array([1, 2]),
    "__MACOSX/mi-proyecto/._main.tex": strToU8("x"),
    "mi-proyecto/.DS_Store": strToU8("x"),
  });

  it("quita la carpeta raíz, ignora basura y archivos de compilación", () => {
    const r = readZip(zip);
    expect(r.strippedRoot).toBe("mi-proyecto");
    expect(r.entries.map((e) => e.path)).toEqual(["img/logo.png", "main.tex"]);
    expect(r.skipped.map((s) => s.reason).sort()).toEqual(["build", "build", "ignored", "ignored"]);
  });

  it("falla con datos que no son zip", () => {
    expect(() => readZip(strToU8("no soy un zip"))).toThrow(/ZIP/);
  });

  it("ida y vuelta con writeZip", () => {
    const r = readZip(zip);
    const again = readZip(writeZip(r.entries));
    expect(again.entries).toEqual(r.entries);
    expect(again.strippedRoot).toBeNull();
  });
});
