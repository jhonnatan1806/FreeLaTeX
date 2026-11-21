import { basename, dirname } from "./paths";

export interface TreeFile {
  type: "file";
  name: string;
  path: string;
}

export interface TreeFolder {
  type: "folder";
  name: string;
  /** "" para la raíz. */
  path: string;
  children: TreeNode[];
}

export type TreeNode = TreeFile | TreeFolder;

const collator = new Intl.Collator("es", { numeric: true, sensitivity: "base" });

function sortNodes(nodes: TreeNode[]) {
  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
    return collator.compare(a.name, b.name);
  });
  for (const n of nodes) if (n.type === "folder") sortNodes(n.children);
}

/**
 * Construye el árbol a partir de las rutas de archivos y de las carpetas
 * explícitas (carpetas vacías). Las carpetas intermedias se deducen.
 */
export function buildTree(files: string[], folders: string[] = []): TreeFolder {
  const root: TreeFolder = { type: "folder", name: "", path: "", children: [] };
  const index = new Map<string, TreeFolder>([["", root]]);

  const ensureFolder = (path: string): TreeFolder => {
    const existing = index.get(path);
    if (existing) return existing;
    const parent = ensureFolder(dirname(path));
    const folder: TreeFolder = { type: "folder", name: basename(path), path, children: [] };
    parent.children.push(folder);
    index.set(path, folder);
    return folder;
  };

  for (const folder of folders) ensureFolder(folder);
  for (const path of files) {
    ensureFolder(dirname(path)).children.push({ type: "file", name: basename(path), path });
  }

  sortNodes(root.children);
  return root;
}

/** Todas las carpetas antecesoras de una ruta ("a/b/c.tex" → ["a", "a/b"]). */
export function ancestors(path: string): string[] {
  const parts = path.split("/");
  const out: string[] = [];
  for (let i = 1; i < parts.length; i++) out.push(parts.slice(0, i).join("/"));
  return out;
}

/** ¿`path` es `folder` o está dentro de él? */
export function isWithin(path: string, folder: string): boolean {
  return folder === "" || path === folder || path.startsWith(`${folder}/`);
}

/** Sustituye el prefijo `from` por `to` en una ruta que está dentro de `from`. */
export function replacePrefix(path: string, from: string, to: string): string {
  return path === from ? to : `${to}${path.slice(from.length)}`;
}

export function joinPath(folder: string, name: string): string {
  return folder ? `${folder}/${name}` : name;
}
