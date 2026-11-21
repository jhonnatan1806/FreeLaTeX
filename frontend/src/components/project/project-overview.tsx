"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/field";
import { db } from "@/lib/db";
import { formatBytes } from "@/lib/format";
import { downloadBytes, exportProjectZip, getProjectFiles, updateProjectSettings } from "@/lib/projects";
import { ENGINES, type Engine } from "@/types/project";

/**
 * Vista provisional del proyecto (fases 2–3): ajustes y lista de archivos.
 * En la fase 4 se sustituye por el editor con árbol, CodeMirror y PDF.
 */
export function ProjectOverview({ projectId }: { projectId: string }) {
  // null = no existe; undefined = cargando.
  const project = useLiveQuery(async () => (await db.projects.get(projectId)) ?? null, [projectId]);
  const files = useLiveQuery(() => getProjectFiles(projectId), [projectId]);

  if (project === undefined || files === undefined) {
    return <p className="p-8 text-sm text-zinc-500">Cargando…</p>;
  }

  if (project === null) {
    return (
      <main className="mx-auto flex max-w-xl flex-col items-center gap-4 p-16 text-center">
        <h1 className="text-xl font-semibold">Proyecto no encontrado</h1>
        <p className="text-sm text-zinc-500">
          Los proyectos se guardan en el navegador donde se crearon. Puede que se haya eliminado o que estés en otro
          navegador.
        </p>
        <Link href="/" className="text-emerald-600 hover:underline">Volver al inicio</Link>
      </main>
    );
  }

  const texFiles = files.filter((f) => f.path.toLowerCase().endsWith(".tex"));
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-10 sm:px-6">
      <Link href="/" className="text-sm text-zinc-500 hover:underline">← Mis proyectos</Link>
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
        <Button
          onClick={async () => {
            const { filename, bytes } = await exportProjectZip(project.id);
            downloadBytes(filename, bytes);
          }}
        >
          Descargar ZIP
        </Button>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        <Field label="Archivo principal">
          <Select
            value={project.mainFile ?? ""}
            onChange={(e) => updateProjectSettings(project.id, { mainFile: e.target.value || null })}
          >
            {!project.mainFile && <option value="">— Elige uno —</option>}
            {texFiles.map((f) => (
              <option key={f.path} value={f.path}>{f.path}</option>
            ))}
          </Select>
        </Field>
        <Field label="Compilador">
          <Select
            value={project.engine}
            onChange={(e) => updateProjectSettings(project.id, { engine: e.target.value as Engine })}
          >
            {ENGINES.map((engine) => (
              <option key={engine} value={engine}>{engine}</option>
            ))}
          </Select>
        </Field>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">
          Archivos <span className="font-normal text-zinc-500">({files.length}, {formatBytes(totalSize)})</span>
        </h2>
        <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 font-mono text-sm dark:divide-zinc-800 dark:border-zinc-800">
          {files.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-4 px-4 py-2">
              <span className="truncate">
                {f.path}
                {f.path === project.mainFile && (
                  <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 font-sans text-xs text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                    principal
                  </span>
                )}
              </span>
              <span className="shrink-0 text-xs text-zinc-500">
                {f.kind === "binary" ? "binario · " : ""}
                {formatBytes(f.size)}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-zinc-500">El editor con árbol de archivos llega en la fase 4.</p>
      </section>
    </main>
  );
}
