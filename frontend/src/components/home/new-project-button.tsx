"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, TextInput } from "@/components/ui/field";
import { createBlankProject } from "@/lib/projects";

export function NewProjectButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const id = await createBlankProject(name);
      router.push(`/project/${id}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="primary" onClick={() => { setName(""); setOpen(true); }}>
        Nuevo proyecto
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Nuevo proyecto en blanco">
        <form id="new-project" onSubmit={submit} className="flex flex-col gap-4">
          <Field label="Nombre">
            <TextInput
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Mi documento"
              maxLength={120}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="primary" disabled={busy}>
              Crear
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
