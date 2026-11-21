import { forwardSearch, parseSynctex, reverseSearch, type PdfRect, type SyncData } from "./synctex";

/**
 * Acceso a SyncTeX a través de un Web Worker: el .synctex de una tesis puede
 * tener cientos de miles de registros y analizarlo en el hilo principal congela
 * la página. Si no hay Workers (tests), se hace en el mismo hilo.
 */

type Forward = { page: number; rects: PdfRect[] } | null;
type Reverse = { file: string; line: number } | null;

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
let local: SyncData | null = null;

function getWorker(): Worker | null {
  if (typeof Worker === "undefined") return null;
  if (!worker) {
    worker = new Worker(new URL("../workers/synctex.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<{ id: number; result?: unknown; error?: string }>) => {
      const { id, result, error } = event.data;
      const p = pending.get(id);
      pending.delete(id);
      if (!p) return;
      if (error) p.reject(new Error(error));
      else p.resolve(result);
    };
  }
  return worker;
}

function call<T>(message: Record<string, unknown>, transfer: Transferable[] = []): Promise<T> {
  const w = getWorker();
  if (!w) return Promise.resolve(runLocally(message) as T);
  const id = nextId++;
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
    w.postMessage({ ...message, id }, transfer);
  });
}

function runLocally(msg: Record<string, unknown>): unknown {
  switch (msg.type) {
    case "load":
      local = parseSynctex(msg.bytes as Uint8Array, msg.mainFile as string);
      return local.records.length;
    case "clear":
      local = null;
      return null;
    case "forward":
      return local ? forwardSearch(local, msg.file as string, msg.line as number) : null;
    case "reverse":
      return local ? reverseSearch(local, msg.page as number, msg.x as number, msg.y as number) : null;
  }
  return null;
}

export const synctexClient = {
  /** Carga los datos SyncTeX (se copian: el original se sigue usando para guardarlo). */
  load(bytes: Uint8Array, mainFile: string): Promise<number> {
    const copy = bytes.slice();
    return call<number>({ type: "load", bytes: copy, mainFile }, [copy.buffer]);
  },
  clear(): Promise<null> {
    return call<null>({ type: "clear" });
  },
  forward(file: string, line: number): Promise<Forward> {
    return call<Forward>({ type: "forward", file, line });
  },
  reverse(page: number, x: number, y: number): Promise<Reverse> {
    return call<Reverse>({ type: "reverse", page, x, y });
  },
};
