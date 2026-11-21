import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FreeLatexDB } from "./db";
import { base64ToBytes, compileProject, CompileRequestError } from "./compile-client";
import { createProject, updateProjectSettings } from "./projects";
import { readZip } from "./zip";

let database: FreeLatexDB;
let projectId: string;

beforeEach(async () => {
  database = new FreeLatexDB(`test-${crypto.randomUUID()}`);
  await database.open();
  projectId = await createProject(
    {
      name: "P",
      mainFile: "tesis/main.tex",
      engine: "xelatex",
      files: [
        { path: "tesis/main.tex", kind: "text", text: "\\documentclass{article}", size: 23 },
        { path: "img.png", kind: "binary", data: new Uint8Array([1, 2, 3]), size: 3 },
      ],
    },
    database,
  );
});

const okResponse = (body: object) => new Response(JSON.stringify(body), { status: 200 });

describe("compileProject", () => {
  it("envía el zip, el archivo principal y el motor", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const form = init!.body as FormData;
      expect(form.get("mainFile")).toBe("tesis/main.tex");
      expect(form.get("engine")).toBe("xelatex");
      const zip = new Uint8Array(await (form.get("project") as Blob).arrayBuffer());
      expect(readZip(zip).entries.map((e) => e.path)).toEqual(["img.png", "tesis/main.tex"]);
      return okResponse({
        status: "success",
        exitCode: 0,
        pdf: btoa("%PDF-1.5"),
        log: "This is pdfTeX",
        synctex: null,
        output: "",
        durationMs: 1200,
      });
    });

    const result = await compileProject(projectId, { database, fetchImpl: fetchImpl as typeof fetch, url: "http://x" });
    expect(fetchImpl).toHaveBeenCalledWith("http://x/compile", expect.objectContaining({ method: "POST" }));
    expect(result.status).toBe("success");
    expect(new TextDecoder().decode(result.pdf!)).toBe("%PDF-1.5");
    expect(result).toMatchObject({ engine: "xelatex", mainFile: "tesis/main.tex", durationMs: 1200 });
  });

  it("falla sin archivo principal", async () => {
    await updateProjectSettings(projectId, { mainFile: null }, database);
    await expect(compileProject(projectId, { database })).rejects.toThrow(/archivo principal/);
  });

  it("traduce errores de red y HTTP", async () => {
    const down = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    await expect(compileProject(projectId, { database, fetchImpl: down as typeof fetch })).rejects.toBeInstanceOf(
      CompileRequestError,
    );

    const bad = vi.fn(async () => new Response(JSON.stringify({ error: "El zip supera el tamaño" }), { status: 413 }));
    await expect(compileProject(projectId, { database, fetchImpl: bad as typeof fetch })).rejects.toThrow(
      "El zip supera el tamaño",
    );
  });
});

describe("base64ToBytes", () => {
  it("decodifica bytes arbitrarios", () => {
    expect(base64ToBytes(btoa(String.fromCharCode(0, 255, 128)))).toEqual(new Uint8Array([0, 255, 128]));
  });
});
