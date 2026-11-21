import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import {
  bracketMatching,
  foldGutter,
  foldKeymap,
  HighlightStyle,
  indentOnInput,
  StreamLanguage,
  syntaxHighlighting,
} from "@codemirror/language";
import { stex } from "@codemirror/legacy-modes/mode/stex";
import { lintGutter } from "@codemirror/lint";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import type { Extension } from "@codemirror/state";
import {
  crosshairCursor,
  drawSelection,
  dropCursor,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
  rectangularSelection,
} from "@codemirror/view";
import { tags as t } from "@lezer/highlight";
import { extname } from "@/lib/paths";
import { latexCompletionSource } from "./latex-completion";

const latex = StreamLanguage.define(stex);
const LATEX_EXT = new Set([".tex", ".sty", ".cls", ".ltx", ".dtx", ".ins", ".bbx", ".cbx", ".clo", ".def", ".bib"]);

/**
 * Colores mediante variables CSS (definidas en globals.css) para que el mismo
 * estado de CodeMirror funcione en modo claro y oscuro sin reconfigurar.
 */
const highlight = HighlightStyle.define([
  { tag: t.tagName, color: "var(--cm-command)" },
  { tag: t.keyword, color: "var(--cm-math)", fontWeight: "600" },
  { tag: t.special(t.variableName), color: "var(--cm-math)" },
  { tag: [t.atom, t.number], color: "var(--cm-number)" },
  { tag: t.bracket, color: "var(--cm-bracket)" },
  { tag: t.comment, color: "var(--cm-comment)", fontStyle: "italic" },
  { tag: [t.variableName, t.string], color: "var(--cm-argument)" },
  { tag: t.invalid, color: "var(--cm-invalid)" },
]);

const theme = EditorView.theme({
  "&": {
    height: "100%",
    fontSize: "14px",
    backgroundColor: "var(--cm-bg)",
    color: "var(--cm-fg)",
  },
  ".cm-scroller": {
    fontFamily: "var(--font-mono), ui-monospace, monospace",
    lineHeight: "1.6",
  },
  ".cm-content": { caretColor: "var(--cm-caret)" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--cm-caret)" },
  ".cm-gutters": {
    backgroundColor: "var(--cm-gutter-bg)",
    color: "var(--cm-gutter-fg)",
    border: "none",
  },
  ".cm-activeLine": { backgroundColor: "var(--cm-active-line)" },
  ".cm-activeLineGutter": { backgroundColor: "var(--cm-active-line)" },
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground": {
    backgroundColor: "var(--cm-selection) !important",
  },
  ".cm-matchingBracket": { backgroundColor: "var(--cm-match)", outline: "none" },
  ".cm-searchMatch": { backgroundColor: "var(--cm-search)" },
  ".cm-panels": { backgroundColor: "var(--cm-gutter-bg)", color: "var(--cm-fg)" },
  ".cm-diagnostic": { fontFamily: "var(--font-sans), system-ui, sans-serif", fontSize: "13px" },
  ".cm-lintRange-error": { backgroundImage: "none", textDecoration: "underline wavy var(--cm-invalid)", textUnderlineOffset: "3px" },
  ".cm-tooltip": { backgroundColor: "var(--cm-bg)", border: "1px solid var(--cm-gutter-fg)" },
});

export interface SetupOptions {
  projectId: string;
  path: string;
  onSave: () => void;
  onCompile: () => void;
  onSyncToPdf: () => void;
  onChange: (state: import("@codemirror/state").EditorState, docChanged: boolean) => void;
}

/** Extensiones de CodeMirror para un archivo. */
export function editorExtensions({ projectId, path, onSave, onCompile, onSyncToPdf, onChange }: SetupOptions): Extension[] {
  const isLatex = LATEX_EXT.has(extname(path));
  return [
    lineNumbers(),
    lintGutter(),
    highlightActiveLineGutter(),
    highlightSpecialChars(),
    history(),
    foldGutter(),
    drawSelection(),
    dropCursor(),
    indentOnInput(),
    bracketMatching(),
    closeBrackets(),
    autocompletion({
      // Solo se activa con una barra invertida o dentro de argumentos (ref, cite, begin...).
      activateOnTyping: true,
      override: isLatex ? [latexCompletionSource(projectId, path)] : [],
      icons: false,
    }),
    rectangularSelection(),
    crosshairCursor(),
    highlightActiveLine(),
    highlightSelectionMatches(),
    EditorView.lineWrapping,
    keymap.of([
      { key: "Mod-s", preventDefault: true, run: () => (onSave(), true) },
      // Antes que defaultKeymap, que usa Mod-Enter para insertar una línea.
      { key: "Mod-Enter", preventDefault: true, run: () => (onCompile(), true) },
      { key: "Mod-Alt-j", preventDefault: true, run: () => (onSyncToPdf(), true) },
      ...closeBracketsKeymap,
      ...defaultKeymap,
      ...searchKeymap,
      ...historyKeymap,
      ...foldKeymap,
      ...completionKeymap,
      indentWithTab,
    ]),
    isLatex ? latex : [],
    syntaxHighlighting(highlight),
    theme,
    EditorView.updateListener.of((update) => {
      if (update.docChanged || update.selectionSet) onChange(update.state, update.docChanged);
    }),
  ];
}
