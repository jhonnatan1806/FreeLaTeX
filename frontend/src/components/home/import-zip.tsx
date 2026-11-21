"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Select, TextInput } from "@/components/ui/field";
import { formatBytes } from "@/lib/format";
import { analyzeZip, createProject, type ZipAnalysis } from "@/lib/projects";

/** Tamaño máximo de zip que aceptamos en el navegador. */
const MAX_ZIP_BYTES = 100 * 1024 * 1024;

export function ImportZip() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<ZipAnalysis | null>(null);
  const [name, setName] = useState("");
  const [mainFile, setMainFile] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!file.name.toLowerCase().endsWith(".zip")) {
      setError("Selecciona un archivo .zip");
      return;
    }
    if (file.size > MAX_ZIP_BYTES) {
      setError(`El ZIP supera ${formatBytes(MAX_ZIP_BYTES)}`);
      return;
    }
    try {
      const result = analyzeZip(file.name, new Uint8Array(await file.arrayBuffer()));
      setAnalysis(result);
      setName(result.suggestedName);
      setMainFile(result.mainFile ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo leer el ZIP");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function confirm() {
    if (!analysis) return;
    setBusy(true);
    try {
      const id = await createProject({ name, files: analysis.entries, mainFile: mainFile || null });
      router.push(`/project/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el proyecto");
      setAnalysis(null);
    } finally {
      setBusy(false);
    }
  }

  const texFiles = analysis?.entries.filter((e) => e.path.toLowerCase().endsWith(".tex")).map((e) => e.path) ?? [];
  const otherTex = texFiles.filter((p) => !analysis?.candidates.includes(p));
  const binaryCount = analysis?.entries.filter((e) => e.kind === "binary").length ?? 0;
  const totalSize = analysis?.entries.reduce((sum, e) => sum + e.size, 0) ?? 0;

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFile(e.dataTransfer.files[0]);
        }}
        className={`flex cursor-pointer flex-col items-center gap-1 rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
          dragging
            ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
            : "border-zinc-300 hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-600"
        }`}
      >
        <span className="font-medium">Subir proyecto (.zip)</span>
        <span className="text-sm text-zinc-500">Arrastra aquí el ZIP o haz clic para elegirlo. Sirve un ZIP descargado de Overleaf.</span>
        <input
          ref={inputRef}
          type="file"
          accept=".zip,application/zip"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <Dialog
        open={analysis !== null}
        onClose={() => setAnalysis(null)}
        title="Importar proyecto"
        footer={
          <>
            <Button onClick={() => setAnalysis(null)}>Cancelar</Button>
            <Button variant="primary" onClick={confirm} disabled={busy || !name.trim()}>
              Importar
            </Button>
          </>
        }
      >
        {analysis && (
          <div className="flex flex-col gap-4">
            <p className="text-zinc-600 dark:text-zinc-400">
              {analysis.entries.length} archivos ({binaryCount} binarios), {formatBytes(totalSize)}.
              {analysis.skipped.length > 0 && ` Se omitieron ${analysis.skipped.length} archivos auxiliares o del sistema.`}
              {analysis.strippedRoot && ` Se quitó la carpeta raíz "${analysis.strippedRoot}".`}
            </p>
            <Field label="Nombre">
              <TextInput value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
            </Field>
            <Field label="Archivo principal">
              <Select value={mainFile} onChange={(e) => setMainFile(e.target.value)}>
                {analysis.candidates.length === 0 && <option value="">— Ninguno detectado —</option>}
                {analysis.candidates.length > 0 && (
                  <optgroup label="Con \documentclass">
                    {analysis.candidates.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </optgroup>
                )}
                {otherTex.length > 0 && (
                  <optgroup label="Otros .tex">
                    {otherTex.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </optgroup>
                )}
              </Select>
            </Field>
            {analysis.candidates.length > 1 && (
              <p className="text-amber-700 dark:text-amber-400">
                Hay {analysis.candidates.length} archivos con \documentclass. Comprueba que el elegido es el correcto.
              </p>
            )}
            {analysis.candidates.length === 0 && (
              <p className="text-amber-700 dark:text-amber-400">
                No se encontró ningún .tex con \documentclass. Podrás elegirlo más tarde.
              </p>
            )}
          </div>
        )}
      </Dialog>
    </>
  );
}
