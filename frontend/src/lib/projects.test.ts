import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import { FreeLatexDB } from "./db";
import {
  analyzeZip,
  createBlankProject,
  createProject,
  deleteProject,
  duplicateProject,
  exportProjectZip,
  getProjectFiles,
  renameProject,
} from "./projects";
import { readZip } from "./zip";

let database: FreeLatexDB;

beforeEach(async () => {
  database = new FreeLatexDB(`test-${crypto.randomUUID()}`);
  await database.open();
});

describe("proyectos", () => {
  it("crea un proyecto en blanco con main.tex", async () => {
    const id = await createBlankProject("Prueba", database);
    const project = await database.projects.get(id);
    expect(project).toMatchObject({ name: "Prueba", mainFile: "main.tex", engine: "pdflatex" });
    const files = await getProjectFiles(id, database);
    expect(files.map((f) => f.path)).toEqual(["main.tex"]);
    expect(files[0].text).toContain("\\documentclass");
  });

  it("importa un zip, conserva binarios y lo exporta igual", async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 9, 9]);
    const zip = zipSync({
      "tesis/main.tex": strToU8("\\documentclass{report}\\begin{document}\\end{document}"),
      "tesis/caps/uno.tex": strToU8("\\chapter{Uno}"),
      "tesis/fig/a.png": png,
    });
    const analysis = analyzeZip("Mi Tesis.zip", zip);
    expect(analysis.suggestedName).toBe("Mi Tesis");
    expect(analysis.mainFile).toBe("main.tex");

    const id = await createProject(
      { name: analysis.suggestedName, files: analysis.entries, mainFile: analysis.mainFile },
      database,
    );
    const { filename, bytes } = await exportProjectZip(id, database);
    expect(filename).toBe("Mi Tesis.zip");
    const back = readZip(bytes);
    expect(back.entries.map((e) => e.path)).toEqual(["caps/uno.tex", "fig/a.png", "main.tex"]);
    expect(back.entries.find((e) => e.path === "fig/a.png")?.data).toEqual(png);
  });

  it("rechaza un zip sin archivos útiles", () => {
    const zip = zipSync({ "__MACOSX/x": strToU8("x"), "a.aux": strToU8("x") });
    expect(() => analyzeZip("x.zip", zip)).toThrow(/no contiene/);
  });

  it("renombra, duplica y borra", async () => {
    const id = await createBlankProject("A", database);
    await renameProject(id, "  B  ", database);
    expect((await database.projects.get(id))?.name).toBe("B");
    await expect(renameProject(id, "   ", database)).rejects.toThrow();

    const copy = await duplicateProject(id, database);
    expect((await database.projects.get(copy))?.name).toBe("B (copia)");
    expect(await getProjectFiles(copy, database)).toHaveLength(1);

    await deleteProject(id, database);
    expect(await database.projects.get(id)).toBeUndefined();
    expect(await getProjectFiles(id, database)).toHaveLength(0);
    expect(await getProjectFiles(copy, database)).toHaveLength(1);
  });
});
