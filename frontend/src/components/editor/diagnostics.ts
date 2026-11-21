import { setDiagnostics, type Diagnostic } from "@codemirror/lint";
import { EditorSelection } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import type { LogEntry } from "@/lib/log-parser";

const SEVERITY: Record<LogEntry["level"], Diagnostic["severity"]> = {
  error: "error",
  warning: "warning",
  typesetting: "info",
};

/** Marca en el editor los errores y avisos del log que pertenecen a `path`. */
export function applyDiagnostics(view: EditorView, entries: LogEntry[], path: string) {
  const doc = view.state.doc;
  const diagnostics: Diagnostic[] = entries
    .filter((e) => e.file === path && e.line !== null)
    .map((e) => {
      const line = doc.line(Math.min(Math.max(e.line!, 1), doc.lines));
      return {
        from: line.from,
        to: line.to,
        severity: SEVERITY[e.level],
        source: e.level === "typesetting" ? "maquetación" : "LaTeX",
        message: e.message,
      };
    });
  view.dispatch(setDiagnostics(view.state, diagnostics));
}

/** Coloca el cursor al inicio de la línea y la centra en pantalla. */
export function jumpToLine(view: EditorView, lineNumber: number | null) {
  if (lineNumber === null) {
    view.focus();
    return;
  }
  const doc = view.state.doc;
  const line = doc.line(Math.min(Math.max(lineNumber, 1), doc.lines));
  view.dispatch({
    selection: EditorSelection.cursor(line.from),
    effects: EditorView.scrollIntoView(line.from, { y: "center" }),
  });
  view.focus();
}
