/// <reference lib="webworker" />
// Analiza el .synctex.gz y responde búsquedas sin bloquear la interfaz.
import { forwardSearch, parseSynctex, reverseSearch, type SyncData } from "../lib/synctex";

let data: SyncData | null = null;

type Request =
  | { id: number; type: "load"; bytes: Uint8Array; mainFile: string }
  | { id: number; type: "clear" }
  | { id: number; type: "forward"; file: string; line: number }
  | { id: number; type: "reverse"; page: number; x: number; y: number };

self.onmessage = (event: MessageEvent<Request>) => {
  const msg = event.data;
  try {
    let result: unknown = null;
    if (msg.type === "load") {
      data = parseSynctex(msg.bytes, msg.mainFile);
      result = data.records.length;
    } else if (msg.type === "clear") {
      data = null;
    } else if (msg.type === "forward") {
      result = data ? forwardSearch(data, msg.file, msg.line) : null;
    } else if (msg.type === "reverse") {
      result = data ? reverseSearch(data, msg.page, msg.x, msg.y) : null;
    }
    self.postMessage({ id: msg.id, result });
  } catch (err) {
    self.postMessage({ id: msg.id, error: err instanceof Error ? err.message : String(err) });
  }
};
