export interface DroppedFile {
  name: string;
  /** Ruta relativa dentro de lo arrastrado (incluye carpetas), p. ej. "figuras/a.png". */
  relativePath: string;
  arrayBuffer(): Promise<ArrayBuffer>;
}

function readAllEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => {
    const all: FileSystemEntry[] = [];
    const next = () =>
      reader.readEntries((batch) => {
        if (batch.length === 0) resolve(all);
        else {
          all.push(...batch);
          next(); // readEntries devuelve los resultados por lotes
        }
      }, reject);
    next();
  });
}

async function walk(entry: FileSystemEntry, prefix: string, out: DroppedFile[]) {
  if (entry.isFile) {
    const file = await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject));
    out.push({ name: file.name, relativePath: prefix + file.name, arrayBuffer: () => file.arrayBuffer() });
  } else if (entry.isDirectory) {
    const children = await readAllEntries((entry as FileSystemDirectoryEntry).createReader());
    for (const child of children) await walk(child, `${prefix}${entry.name}/`, out);
  }
}

/** Lee archivos y carpetas arrastrados desde el sistema operativo. */
export async function readDataTransfer(dt: DataTransfer): Promise<DroppedFile[]> {
  const entries = [...dt.items]
    .filter((item) => item.kind === "file")
    .map((item) => item.webkitGetAsEntry?.())
    .filter((e): e is FileSystemEntry => !!e);

  if (entries.length === 0) {
    return [...dt.files].map((f) => ({ name: f.name, relativePath: f.name, arrayBuffer: () => f.arrayBuffer() }));
  }
  const out: DroppedFile[] = [];
  for (const entry of entries) await walk(entry, "", out);
  return out;
}

/** Convierte un FileList de <input> (con webkitdirectory, si se usó). */
export function fromFileList(list: FileList): DroppedFile[] {
  return [...list].map((f) => ({
    name: f.name,
    relativePath: f.webkitRelativePath || f.name,
    arrayBuffer: () => f.arrayBuffer(),
  }));
}
