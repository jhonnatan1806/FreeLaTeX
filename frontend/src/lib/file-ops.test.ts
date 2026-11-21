import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { FreeLatexDB } from "./db";
import {
  addEntries,
  createFile,
  createFolder,
  deletePath,
  movePath,
  renamePath,
  saveFileText,
} from "./file-ops";
import { createProject, getProjectFiles } from "./projects";

let database: FreeLatexDB;
let projectId: string;

const text = (path: string, t = "x") => ({ path, kind: "text" as const, text: t, size: t.length });

async function paths() {
  return (await getProjectFiles(projectId, database)).map((f) => f.path);
}
async function folders() {
  return (await database.folders.where("projectId").equals(projectId).toArray()).map((f) => f.path).sort();
}
async function mainFile() {
  return (await database.projects.get(projectId))?.mainFile;
}

beforeEach(async () => {
  database = new FreeLatexDB(`test-${crypto.randomUUID()}`);
  await database.open();
  projectId = await createProject(
    { name: "P", mainFile: "tesis/main.tex", files: [text("tesis/main.tex"), text("tesis/cap/uno.tex"), text("refs.bib")] },
    database,
  );
});

describe("crear", () => {
  it("crea archivos y carpetas", async () => {
    await createFile(projectId, "tesis/cap/dos.tex", "hola", database);
    await createFolder(projectId, "figuras", database);
    expect(await paths()).toContain("tesis/cap/dos.tex");
    expect(await folders()).toEqual(["figuras"]);
  });

  it("rechaza duplicados y nombres inválidos", async () => {
    await expect(createFile(projectId, "refs.bib", "", database)).rejects.toThrow(/Ya existe/);
    await expect(createFolder(projectId, "tesis", database)).rejects.toThrow(/Ya existe/);
    await expect(createFile(projectId, "a:b.tex", "", database)).rejects.toThrow(/no válido/);
    await expect(createFile(projectId, "../x.tex", "", database)).rejects.toThrow(/no válido/);
    await expect(createFile(projectId, "refs.bib/x.tex", "", database)).rejects.toThrow(/es un archivo/);
  });
});

describe("renombrar y mover", () => {
  it("renombra un archivo", async () => {
    await renamePath(projectId, "refs.bib", "biblio.bib", database);
    expect(await paths()).toEqual(["biblio.bib", "tesis/cap/uno.tex", "tesis/main.tex"]);
  });

  it("renombra una carpeta con todo su contenido y actualiza el principal", async () => {
    await createFolder(projectId, "tesis/vacia", database);
    await renamePath(projectId, "tesis", "doc", database);
    expect(await paths()).toEqual(["doc/cap/uno.tex", "doc/main.tex", "refs.bib"]);
    expect(await folders()).toEqual(["doc/vacia"]);
    expect(await mainFile()).toBe("doc/main.tex");
  });

  it("mueve a otra carpeta y a la raíz", async () => {
    await movePath(projectId, "refs.bib", "tesis", database);
    expect(await paths()).toContain("tesis/refs.bib");
    await movePath(projectId, "tesis/cap/uno.tex", "", database);
    expect(await paths()).toContain("uno.tex");
  });

  it("no permite mover una carpeta dentro de sí misma ni pisar otra ruta", async () => {
    await expect(movePath(projectId, "tesis", "tesis/cap", database)).rejects.toThrow(/sí misma/);
    await expect(renamePath(projectId, "refs.bib", "tesis/main.tex", database)).rejects.toThrow(/Ya existe/);
  });

  it("conserva el contenido", async () => {
    await saveFileText(projectId, "refs.bib", "@book{a}", database);
    await renamePath(projectId, "refs.bib", "otro.bib", database);
    const file = (await getProjectFiles(projectId, database)).find((f) => f.path === "otro.bib");
    expect(file?.text).toBe("@book{a}");
  });
});

describe("eliminar", () => {
  it("elimina una carpeta recursivamente y limpia el principal", async () => {
    await deletePath(projectId, "tesis", database);
    expect(await paths()).toEqual(["refs.bib"]);
    expect(await mainFile()).toBeNull();
  });

  it("no toca rutas con prefijo parecido", async () => {
    await createFile(projectId, "tesis2.tex", "", database);
    await deletePath(projectId, "tesis", database);
    expect(await paths()).toEqual(["refs.bib", "tesis2.tex"]);
  });
});

describe("subir", () => {
  it("añade y reemplaza archivos en una carpeta", async () => {
    await addEntries(projectId, "tesis", [text("cap/uno.tex", "nuevo"), text("img/a.svg", "<svg/>")], database);
    const files = await getProjectFiles(projectId, database);
    expect(files.find((f) => f.path === "tesis/cap/uno.tex")?.text).toBe("nuevo");
    expect(files.map((f) => f.path)).toContain("tesis/img/a.svg");
  });
});
