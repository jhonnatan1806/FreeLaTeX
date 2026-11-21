import {
  type Completion,
  type CompletionContext,
  type CompletionResult,
  snippet,
  startCompletion,
} from "@codemirror/autocomplete";
import type { EditorView } from "@codemirror/view";
import { db } from "@/lib/db";
import { buildIndex, relativeToMain, type ProjectIndex } from "@/lib/latex-index";
import { extname } from "@/lib/paths";

// --- Datos estáticos -------------------------------------------------------

/** [comando, plantilla (opcional), descripción]. En la plantilla, ${} es un campo. */
const COMMANDS: [string, string?, string?][] = [
  ["part", "\\part{${}}", "sección"],
  ["chapter", "\\chapter{${}}", "sección"],
  ["section", "\\section{${}}", "sección"],
  ["section*", "\\section*{${}}", "sección sin número"],
  ["subsection", "\\subsection{${}}", "sección"],
  ["subsection*", "\\subsection*{${}}", "sección sin número"],
  ["subsubsection", "\\subsubsection{${}}", "sección"],
  ["paragraph", "\\paragraph{${}}", "sección"],
  ["textbf", "\\textbf{${}}", "negrita"],
  ["textit", "\\textit{${}}", "cursiva"],
  ["emph", "\\emph{${}}", "énfasis"],
  ["underline", "\\underline{${}}", "subrayado"],
  ["texttt", "\\texttt{${}}", "monoespaciado"],
  ["textsc", "\\textsc{${}}", "versalitas"],
  ["text", "\\text{${}}", "texto en matemáticas"],
  ["label", "\\label{${}}", "etiqueta"],
  ["ref", "\\ref{${}}", "referencia"],
  ["eqref", "\\eqref{${}}", "referencia a ecuación"],
  ["pageref", "\\pageref{${}}", "referencia a página"],
  ["autoref", "\\autoref{${}}", "referencia (hyperref)"],
  ["cref", "\\cref{${}}", "referencia (cleveref)"],
  ["cite", "\\cite{${}}", "cita"],
  ["citep", "\\citep{${}}", "cita (natbib)"],
  ["citet", "\\citet{${}}", "cita (natbib)"],
  ["parencite", "\\parencite{${}}", "cita (biblatex)"],
  ["textcite", "\\textcite{${}}", "cita (biblatex)"],
  ["autocite", "\\autocite{${}}", "cita (biblatex)"],
  ["footnote", "\\footnote{${}}", "nota al pie"],
  ["caption", "\\caption{${}}", "leyenda"],
  ["includegraphics", "\\includegraphics[width=\\linewidth]{${}}", "imagen"],
  ["input", "\\input{${}}", "incluir archivo"],
  ["include", "\\include{${}}", "incluir capítulo"],
  ["usepackage", "\\usepackage{${}}", "paquete"],
  ["documentclass", "\\documentclass{${}}", "clase"],
  ["begin", "\\begin{${}}", "entorno"],
  ["end", "\\end{${}}", "fin de entorno"],
  ["item", "\\item ", "elemento de lista"],
  ["frac", "\\frac{${}}{${}}", "fracción"],
  ["sqrt", "\\sqrt{${}}", "raíz"],
  ["mathbb", "\\mathbb{${}}", "pizarra"],
  ["mathcal", "\\mathcal{${}}", "caligráfica"],
  ["mathrm", "\\mathrm{${}}", "romana"],
  ["mathbf", "\\mathbf{${}}", "negrita"],
  ["url", "\\url{${}}", "enlace"],
  ["href", "\\href{${}}{${}}", "enlace con texto"],
  ["title", "\\title{${}}"],
  ["author", "\\author{${}}"],
  ["date", "\\date{${}}"],
  ["vspace", "\\vspace{${}}"],
  ["hspace", "\\hspace{${}}"],
  ["newcommand", "\\newcommand{\\${}}{${}}", "definir comando"],
  ["renewcommand", "\\renewcommand{\\${}}{${}}"],
  ["addbibresource", "\\addbibresource{${}}", "biblatex"],
  ["bibliography", "\\bibliography{${}}", "bibtex"],
  ["bibliographystyle", "\\bibliographystyle{${}}"],
  ["multicolumn", "\\multicolumn{${}}{${}}{${}}"],
  ...[
    "maketitle", "tableofcontents", "listoffigures", "listoftables", "printbibliography", "appendix",
    "centering", "noindent", "newline", "newpage", "clearpage", "hline", "toprule", "midrule", "bottomrule",
    "hfill", "vfill", "today", "LaTeX", "TeX", "ldots", "dots", "cdots", "quad", "qquad", "cdot", "times",
    "leq", "geq", "neq", "approx", "equiv", "infty", "partial", "nabla", "sum", "prod", "int", "oint", "lim",
    "rightarrow", "leftarrow", "Rightarrow", "Leftarrow", "Leftrightarrow", "mapsto", "to", "in", "notin",
    "subset", "subseteq", "cup", "cap", "forall", "exists", "pm", "mp", "left", "right", "langle", "rangle",
    "alpha", "beta", "gamma", "delta", "epsilon", "varepsilon", "zeta", "eta", "theta", "vartheta", "iota",
    "kappa", "lambda", "mu", "nu", "xi", "pi", "rho", "sigma", "tau", "upsilon", "phi", "varphi", "chi", "psi",
    "omega", "Gamma", "Delta", "Theta", "Lambda", "Xi", "Pi", "Sigma", "Phi", "Psi", "Omega",
    "textwidth", "linewidth", "small", "footnotesize", "tiny", "normalsize", "large", "Large", "LARGE", "huge",
    "Huge", "bigskip", "medskip", "smallskip",
  ].map((n): [string] => [n]),
];

const ENVIRONMENTS = [
  "document", "itemize", "enumerate", "description", "figure", "figure*", "table", "table*", "tabular", "tabularx",
  "equation", "equation*", "align", "align*", "gather", "gather*", "multline", "split", "cases", "matrix",
  "pmatrix", "bmatrix", "vmatrix", "array", "center", "flushleft", "flushright", "quote", "quotation", "verbatim",
  "abstract", "minipage", "proof", "theorem", "lemma", "definition", "lstlisting", "frame", "columns", "column",
  "thebibliography", "subfigure", "titlepage", "appendices",
];

const PACKAGES = [
  "amsmath", "amssymb", "amsthm", "graphicx", "hyperref", "geometry", "babel", "inputenc", "fontenc", "lmodern",
  "booktabs", "tabularx", "multirow", "xcolor", "tikz", "pgfplots", "listings", "minted", "caption", "subcaption",
  "float", "biblatex", "natbib", "cleveref", "csquotes", "enumitem", "fancyhdr", "setspace", "siunitx", "url",
  "microtype", "mathtools", "algorithm2e", "algorithmic", "physics", "longtable", "array", "parskip", "titlesec",
];

const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".pdf", ".eps", ".svg", ".gif"]);

// --- Índice del proyecto (con caché corta) ---------------------------------

let cache: { projectId: string; at: number; index: ProjectIndex; mainFile: string | null } | null = null;

async function loadIndex(projectId: string, currentPath: string, currentText: string) {
  const now = Date.now();
  if (!cache || cache.projectId !== projectId || now - cache.at > 3000) {
    const [project, files] = await Promise.all([
      db.projects.get(projectId),
      db.files.where("projectId").equals(projectId).toArray(),
    ]);
    cache = {
      projectId,
      at: now,
      mainFile: project?.mainFile ?? null,
      index: buildIndex(files.map((f) => ({ path: f.path, text: f.kind === "text" ? f.text : undefined }))),
    };
  }
  // El archivo abierto puede tener cambios aún sin guardar: usar su texto actual.
  const others = buildIndex([{ path: currentPath, text: currentText }]);
  const index: ProjectIndex = {
    files: cache.index.files,
    labels: [...cache.index.labels.filter((l) => l.file !== currentPath), ...others.labels],
    bib: [...cache.index.bib.filter((b) => b.file !== currentPath), ...others.bib],
    commands: [...cache.index.commands, ...others.commands],
    environments: [...cache.index.environments, ...others.environments],
  };
  return { index, mainFile: cache.mainFile };
}

// --- Aplicación de completados -----------------------------------------------

/** Inserta una plantilla y vuelve a abrir el autocompletado si el comando lleva argumento con opciones. */
function applySnippet(template: string, reopen = false) {
  const apply = snippet(template);
  return (view: EditorView, completion: Completion, from: number, to: number) => {
    apply(view, completion, from, to);
    if (reopen) setTimeout(() => startCompletion(view), 0);
  };
}

/** Si closeBrackets ya puso "}" tras el cursor, reemplazarla también. */
function consumeBrace(view: EditorView, to: number) {
  return view.state.doc.sliceString(to, to + 1) === "}" ? to + 1 : to;
}

const REOPEN = new Set(["ref", "eqref", "pageref", "autoref", "cref", "cite", "citep", "citet", "parencite", "textcite", "autocite", "begin", "input", "include", "includegraphics", "usepackage", "addbibresource", "bibliography"]);

function commandOptions(index: ProjectIndex): Completion[] {
  const seen = new Set<string>();
  const out: Completion[] = [];
  for (const [name, template, detail] of COMMANDS) {
    seen.add(name);
    out.push({
      label: `\\${name}`,
      detail,
      type: "keyword",
      apply: template ? applySnippet(template, REOPEN.has(name)) : `\\${name}`,
    });
  }
  for (const c of index.commands) {
    if (seen.has(c.name)) continue;
    seen.add(c.name);
    const template = `\\${c.name}${"{${}}".repeat(c.args)}`;
    out.push({ label: `\\${c.name}`, detail: "del proyecto", type: "function", apply: applySnippet(template), boost: 1 });
  }
  return out;
}

// --- Fuente de completado -----------------------------------------------------

const REF_COMMANDS = /^(ref|eqref|pageref|autoref|[cC]ref|vref|nameref)$/;
const CITE_COMMANDS = /^(cite[tp]?\*?|[pP]arencite|[tT]extcite|[aA]utocite|footcite|nocite|citeauthor|citeyear|fullcite)$/;

export function latexCompletionSource(projectId: string, path: string) {
  return async (ctx: CompletionContext): Promise<CompletionResult | null> => {
    const line = ctx.state.doc.lineAt(ctx.pos);
    const before = line.text.slice(0, ctx.pos - line.from);

    // Dentro del argumento de un comando: \cmd[opciones]{parcial
    const arg = /\\([a-zA-Z]+\*?)(?:\[[^\]]*\])*\{([^{}]*)$/.exec(before);
    if (arg) {
      const [, cmd, partial] = arg;
      const { index, mainFile } = await loadIndex(projectId, path, ctx.state.doc.toString());
      // En listas separadas por comas (citas múltiples) se completa la última.
      const lastComma = partial.lastIndexOf(",");
      const from = ctx.pos - partial.length + (lastComma + 1) + (partial.slice(lastComma + 1).match(/^\s*/)?.[0].length ?? 0);

      let options: Completion[] = [];
      if (REF_COMMANDS.test(cmd)) {
        options = index.labels.map((l) => ({ label: l.label, detail: l.file, type: "variable" }));
      } else if (CITE_COMMANDS.test(cmd)) {
        options = index.bib.map((b) => ({
          label: b.key,
          detail: [b.author?.split(" and ")[0], b.year].filter(Boolean).join(", "),
          info: b.title,
          type: "text",
        }));
      } else if (cmd === "begin") {
        const envs = [...new Set([...ENVIRONMENTS, ...index.environments])];
        options = envs.map((env) => ({
          label: env,
          type: "type",
          // Completa también \end{...} con el cursor dentro del entorno.
          apply: (view: EditorView, c: Completion, f: number, t: number) =>
            snippet(`${env}}\n\t\${}\n\\end{${env}}`)(view, c, f, consumeBrace(view, t)),
        }));
      } else if (cmd === "end") {
        options = [...new Set([...ENVIRONMENTS, ...index.environments])].map((env) => ({ label: env, type: "type" }));
      } else if (cmd === "input" || cmd === "include" || cmd === "subfile") {
        options = index.files
          .filter((f) => extname(f) === ".tex")
          .map((f) => ({ label: relativeToMain(f, mainFile).replace(/\.tex$/, ""), type: "text" }));
      } else if (cmd === "includegraphics") {
        options = index.files
          .filter((f) => IMAGE_EXT.has(extname(f)))
          .map((f) => ({ label: relativeToMain(f, mainFile), type: "text" }));
      } else if (cmd === "addbibresource" || cmd === "bibliography") {
        options = index.files
          .filter((f) => extname(f) === ".bib")
          .map((f) => {
            const rel = relativeToMain(f, mainFile);
            return { label: cmd === "bibliography" ? rel.replace(/\.bib$/, "") : rel, type: "text" };
          });
      } else if (cmd === "usepackage" || cmd === "RequirePackage") {
        options = PACKAGES.map((p) => ({ label: p, type: "namespace" }));
      } else {
        return null;
      }
      return { from, options, validFor: /^[^{},\s]*$/ };
    }

    // Comando: \abc
    const word = ctx.matchBefore(/\\[a-zA-Z]*\*?/);
    if (word && (word.from < word.to || ctx.explicit)) {
      const { index } = await loadIndex(projectId, path, ctx.state.doc.toString());
      return { from: word.from, options: commandOptions(index), validFor: /^\\[a-zA-Z]*\*?$/ };
    }
    return null;
  };
}
