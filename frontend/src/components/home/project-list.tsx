"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, TextInput } from "@/components/ui/field";
import { db } from "@/lib/db";
import { timeAgo } from "@/lib/format";
import {
  deleteProject,
  downloadBytes,
  duplicateProject,
  exportProjectZip,
  renameProject,
} from "@/lib/projects";
import type { Project } from "@/types/project";

export function ProjectList() {
  const projects = useLiveQuery(() => db.projects.orderBy("updatedAt").reverse().toArray(), []);
  const [renaming, setRenaming] = useState<Project | null>(null);
  const [newName, setNewName] = useState("");
  const [deleting, setDeleting] = useState<Project | null>(null);

  if (projects === undefined) {
    return <p className="text-sm text-zinc-500">Cargando proyectos…</p>;
  }

  if (projects.length === 0) {
    return (
      <p className="rounded-lg border border-zinc-200 p-6 text-center text-sm text-zinc-500 dark:border-zinc-800">
        Aún no tienes proyectos. Crea uno nuevo o sube un ZIP.
      </p>
    );
  }

  return (
    <>
      <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {projects.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <div className="flex min-w-0 flex-1 flex-col">
              <Link href={`/project/${p.id}`} className="truncate font-medium hover:underline">
                {p.name}
              </Link>
              <span className="text-xs text-zinc-500">
                {p.mainFile ?? "sin archivo principal"} · {p.engine} · modificado {timeAgo(p.updatedAt)}
              </span>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" onClick={() => { setNewName(p.name); setRenaming(p); }}>
                Renombrar
              </Button>
              <Button variant="ghost" onClick={() => duplicateProject(p.id)}>
                Duplicar
              </Button>
              <Button
                variant="ghost"
                onClick={async () => {
                  const { filename, bytes } = await exportProjectZip(p.id);
                  downloadBytes(filename, bytes);
                }}
              >
                Descargar
              </Button>
              <Button variant="ghost" className="text-red-600 dark:text-red-400" onClick={() => setDeleting(p)}>
                Eliminar
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <Dialog open={renaming !== null} onClose={() => setRenaming(null)} title="Renombrar proyecto">
        <form
          className="flex flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (renaming && newName.trim()) {
              await renameProject(renaming.id, newName);
              setRenaming(null);
            }
          }}
        >
          <Field label="Nombre">
            <TextInput autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={120} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setRenaming(null)}>Cancelar</Button>
            <Button type="submit" variant="primary" disabled={!newName.trim()}>
              Guardar
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Eliminar proyecto"
        footer={
          <>
            <Button onClick={() => setDeleting(null)}>Cancelar</Button>
            <Button
              variant="danger"
              onClick={async () => {
                if (deleting) await deleteProject(deleting.id);
                setDeleting(null);
              }}
            >
              Eliminar
            </Button>
          </>
        }
      >
        <p>
          Se eliminará <strong>{deleting?.name}</strong> de este navegador. No se puede deshacer; descárgalo antes si
          quieres conservar una copia.
        </p>
      </Dialog>
    </>
  );
}
