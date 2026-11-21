export interface SearchOptions {
  caseSensitive?: boolean;
  regex?: boolean;
  /** Máximo de coincidencias devueltas. */
  limit?: number;
}

export interface SearchMatch {
  path: string;
  line: number; // 1-based
  /** Texto de la línea (recortado si es muy largo). */
  text: string;
  /** Posición de la coincidencia dentro de `text`. */
  start: number;
  end: number;
}

export interface SearchResult {
  matches: SearchMatch[];
  /** Hubo más coincidencias que el límite. */
  truncated: boolean;
  /** La expresión regular no es válida. */
  error?: string;
}

const MAX_LINE = 200;

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Busca texto en los archivos de texto del proyecto. */
export function searchProject(
  files: { path: string; text?: string }[],
  query: string,
  { caseSensitive = false, regex = false, limit = 500 }: SearchOptions = {},
): SearchResult {
  if (!query) return { matches: [], truncated: false };
  let re: RegExp;
  try {
    re = new RegExp(regex ? query : escapeRegex(query), caseSensitive ? "g" : "gi");
  } catch (err) {
    return { matches: [], truncated: false, error: err instanceof Error ? err.message : String(err) };
  }

  const matches: SearchMatch[] = [];
  for (const file of [...files].sort((a, b) => a.path.localeCompare(b.path))) {
    if (file.text === undefined) continue;
    const lines = file.text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(line))) {
        if (m[0].length === 0) {
          re.lastIndex++; // evitar bucles con coincidencias vacías
          continue;
        }
        if (matches.length >= limit) return { matches, truncated: true };
        // Recortar líneas largas alrededor de la coincidencia.
        let text = line;
        let start = m.index;
        if (line.length > MAX_LINE) {
          const from = Math.max(0, m.index - 60);
          text = (from > 0 ? "…" : "") + line.slice(from, from + MAX_LINE);
          start = m.index - from + (from > 0 ? 1 : 0);
        }
        matches.push({ path: file.path, line: i + 1, text, start, end: start + m[0].length });
      }
    }
  }
  return { matches, truncated: false };
}
