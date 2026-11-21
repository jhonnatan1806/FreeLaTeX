"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { EditorLayout } from "@/components/editor/editor-layout";

function ProjectFromUrl() {
  const { id } = useParams<{ id: string }>();
  return <EditorLayout projectId={id} />;
}

// Página cliente: los datos del proyecto viven en IndexedDB, no en el servidor.
// El id de la URL solo existe en tiempo de ejecución, por eso va en <Suspense>.
export default function ProjectPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-fg-subtle">Cargando…</p>}>
      <ProjectFromUrl />
    </Suspense>
  );
}
