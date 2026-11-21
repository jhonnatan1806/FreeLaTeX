"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useCallback, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ContextMenu, type MenuEntry } from "@/components/ui/context-menu";
import { Dialog } from "@/components/ui/dialog";
import { Field, TextInput } from "@/components/ui/field";
import {
  ChevronIcon,
  DotsIcon,
  FileIcon,
  FilePlusIcon,
  FolderIcon,
  FolderPlusIcon,
  ImageIcon,
  StarIcon,
  UploadIcon,
} from "@/components/ui/icons";
import { db } from "@/lib/db";
import { fromFileList, readDataTransfer, type DroppedFile } from "@/lib/dropped-files";
import {
  addEntries,
  createFile,
  createFolder,
  deletePath,
  filesToEntries,
  movePath,
  renamePath,
} from "@/lib/file-ops";
import { basename, dirname, extname, isValidName } from "@/lib/paths";
import { downloadBytes, updateProjectSettings } from "@/lib/projects";
import { buildTree, isWithin, joinPath, type TreeNode } from "@/lib/tree";
import { fileBytes } from "@/lib/zip";
import { useEditorStore } from "@/store/editor-store";

const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp", ".svg", ".eps", ".pdf", ".tif", ".tiff"]);
const DRAG_TYPE = "application/x-freelatex-path";

type Creating = { kind: "file" | "folder"; parent: string } | null;
type MenuState = { x: number; y: number; node: TreeNode | null } | null;

interface FileTreeProps {
  projectId: string;
  mainFile: string | null;
}

export function FileTree({ projectId, mainFile }: FileTreeProps) {
  // Solo las claves: así no se cargan los contenidos al cambiar un archivo.
  const fileIds = useLiveQuery(() => db.files.where("projectId").equals(projectId).primaryKeys(), [projectId]);
  const folderIds = useLiveQuery(() => db.folders.where("projectId").equals(projectId).primaryKeys(), [projectId]);

  const tree = useMemo(() => {
    const strip = (id: string) => id.slice(projectId.length + 1);
    return buildTree((fileIds ?? []).map(strip), (folderIds ?? []).map(strip));
  }, [fileIds, folderIds, projectId]);

  const store = useEditorStore();
  const { expanded, selected, activePath } = store;

  const [renaming, setRenaming] = useState<string | null>(null);
  const [creating, setCreating] = useState<Creating>(null);
  const [newName, setNewName] = useState("");
  const [deleting, setDeleting] = useState<TreeNode | null>(null);
  const [menu, setMenu] = useState<MenuState>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Input de subida y carpeta destino como estado (no refs) para usarlos en menús.
  const [uploadInput, setUploadInput] = useState<HTMLInputElement | null>(null);
  const [uploadTarget, setUploadTarget] = useState("");
  const cancelRename = useRef(false);

  /** Ejecuta una operación mostrando el error, tras guardar cambios pendientes. */
  const run = useCallback(
    async (op: () => Promise<void>) => {
      setError(null);
      try {
        await store.flushSaves();
        await op();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [store],
  );

  /** Carpeta destino para crear/subir según la selección actual. */
  const targetFolder = (): string => {
    if (!selected) return "";
    const isFolder = (fileIds ?? []).every((id) => id !== `${projectId}/${selected}`);
    return isFolder ? selected : dirname(selected);
  };

  const startCreate = (kind: "file" | "folder", parent = targetFolder()) => {
    setNewName(kind === "file" ? "nuevo.tex" : "");
    setCreating({ kind, parent });
  };

  const submitCreate = () =>
    run(async () => {
      if (!creating) return;
      const path = joinPath(creating.parent, newName.trim());
      if (creating.kind === "file") {
        const created = await createFile(projectId, path, "", db);
        store.revealPath(created);
        store.openFile(created);
      } else {
        const created = await createFolder(projectId, path, db);
        store.revealPath(created);
        store.expand(created);
      }
      setCreating(null);
    });

  const commitRename = (node: TreeNode, name: string) =>
    run(async () => {
      setRenaming(null);
      const trimmed = name.trim();
      if (!trimmed || trimmed === node.name) return;
      if (!isValidName(trimmed)) throw new Error(`Nombre no válido: "${trimmed}"`);
      const to = await renamePath(projectId, node.path, joinPath(dirname(node.path), trimmed), db);
      store.onRenamed(node.path, to);
    });

  const move = (from: string, folder: string) =>
    run(async () => {
      if (dirname(from) === folder || isWithin(folder, from)) return;
      const to = await movePath(projectId, from, folder, db);
      store.onRenamed(from, to);
      if (folder) store.expand(folder);
    });

  const upload = (files: DroppedFile[], folder: string) =>
    run(async () => {
      if (files.length === 0) return;
      const entries = await filesToEntries(files);
      const written = await addEntries(projectId, folder, entries, db);
      store.invalidate(written);
      if (folder) store.expand(folder);
      if (written.length === 1) store.revealPath(written[0]);
    });

  const confirmDelete = () =>
    run(async () => {
      if (!deleting) return;
      await deletePath(projectId, deleting.path, db);
      store.onDeleted(deleting.path);
      setDeleting(null);
    });

  const download = async (path: string) => {
    const file = await db.files.get(`${projectId}/${path}`);
    if (file) downloadBytes(basename(path), fileBytes(file), "application/octet-stream");
  };

  const menuItems = (node: TreeNode | null): MenuEntry[] => {
    if (!node) {
      return [
        { label: "Nuevo archivo", onSelect: () => startCreate("file", "") },
        { label: "Nueva carpeta", onSelect: () => startCreate("folder", "") },
        { label: "Subir archivos", onSelect: () => openUpload("") },
      ];
    }
    if (node.type === "folder") {
      return [
        { label: "Nuevo archivo aquí", onSelect: () => startCreate("file", node.path) },
        { label: "Nueva carpeta aquí", onSelect: () => startCreate("folder", node.path) },
        { label: "Subir archivos aquí", onSelect: () => openUpload(node.path) },
        "separator",
        { label: "Renombrar", onSelect: () => setRenaming(node.path) },
        { label: "Eliminar", danger: true, onSelect: () => setDeleting(node) },
      ];
    }
    return [
      { label: "Abrir", onSelect: () => store.openFile(node.path) },
      {
        label: "Usar como archivo principal",
        disabled: extname(node.path) !== ".tex" || node.path === mainFile,
        onSelect: () => updateProjectSettings(projectId, { mainFile: node.path }),
      },
      { label: "Descargar", onSelect: () => download(node.path) },
      "separator",
      { label: "Renombrar", onSelect: () => setRenaming(node.path) },
      { label: "Eliminar", danger: true, onSelect: () => setDeleting(node) },
    ];
  };

  const openUpload = (folder: string) => {
    setUploadTarget(folder);
    uploadInput?.click();
  };

  // --- Arrastrar y soltar (mover nodos y subir desde el sistema) ---
  const onDragOver = (e: React.DragEvent, folder: string) => {
    const types = e.dataTransfer.types;
    if (!types.includes(DRAG_TYPE) && !types.includes("Files")) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = types.includes(DRAG_TYPE) ? "move" : "copy";
    setDropTarget(folder);
  };

  const onDrop = async (e: React.DragEvent, folder: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDropTarget(null);
    const from = e.dataTransfer.getData(DRAG_TYPE);
    if (from) move(from, folder);
    else if (e.dataTransfer.types.includes("Files")) upload(await readDataTransfer(e.dataTransfer), folder);
  };

  const renderNode = (node: TreeNode, depth: number): React.ReactNode => {
    const isFolder = node.type === "folder";
    const isOpen = isFolder && expanded.has(node.path);
    const isSelected = selected === node.path;
    const isActive = activePath === node.path;
    const isMain = node.path === mainFile;
    const ext = extname(node.path);
    const folderForDrop = isFolder ? node.path : dirname(node.path);

    return (
      <li key={node.path} role="treeitem" aria-expanded={isFolder ? isOpen : undefined} aria-selected={isSelected}>
        <div
          draggable={renaming !== node.path}
          onDragStart={(e) => {
            e.dataTransfer.setData(DRAG_TYPE, node.path);
            e.dataTransfer.effectAllowed = "move";
          }}
          onDragOver={(e) => onDragOver(e, folderForDrop)}
          onDragLeave={() => setDropTarget(null)}
          onDrop={(e) => onDrop(e, folderForDrop)}
          onClick={() => {
            if (isFolder) {
              store.toggleFolder(node.path);
              store.select(node.path);
            } else {
              store.openFile(node.path);
            }
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            store.select(node.path);
            setMenu({ x: e.clientX, y: e.clientY, node });
          }}
          onKeyDown={(e) => {
            if (e.key === "F2") setRenaming(node.path);
            if (e.key === "Delete") setDeleting(node);
            if (e.key === "Enter" && !isFolder) store.openFile(node.path);
          }}
          tabIndex={0}
          style={{ paddingLeft: 6 + depth * 14 }}
          className={`group flex h-7 cursor-pointer select-none items-center gap-1.5 pr-1 text-sm outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-emerald-600 ${
            isActive
              ? "bg-emerald-100 text-emerald-950 dark:bg-emerald-900/40 dark:text-emerald-100"
              : isSelected
                ? "bg-zinc-200/70 dark:bg-zinc-800"
                : "hover:bg-zinc-100 dark:hover:bg-zinc-800/60"
          } ${isFolder && dropTarget === node.path ? "ring-1 ring-inset ring-emerald-500" : ""}`}
          title={node.path}
        >
          {isFolder ? (
            <>
              <ChevronIcon
                width={12}
                height={12}
                className={`shrink-0 text-zinc-400 transition-transform ${isOpen ? "rotate-90" : ""}`}
              />
              <FolderIcon className="shrink-0 text-amber-500" />
            </>
          ) : (
            <>
              <span className="w-3 shrink-0" />
              {IMAGE_EXT.has(ext) ? (
                <ImageIcon className="shrink-0 text-sky-500" />
              ) : (
                <FileIcon className={`shrink-0 ${ext === ".tex" ? "text-emerald-600" : "text-zinc-400"}`} />
              )}
            </>
          )}

          {renaming === node.path ? (
            <input
              autoFocus
              defaultValue={node.name}
              onClick={(e) => e.stopPropagation()}
              onFocus={(e) => {
                // Seleccionar el nombre sin la extensión.
                const dot = node.name.lastIndexOf(".");
                e.target.setSelectionRange(0, dot > 0 && !isFolder ? dot : node.name.length);
              }}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") {
                  cancelRename.current = true;
                  setRenaming(null);
                }
              }}
              onBlur={(e) => {
                if (cancelRename.current) cancelRename.current = false;
                else commitRename(node, e.currentTarget.value);
              }}
              className="min-w-0 flex-1 rounded border border-emerald-600 bg-white px-1 text-sm text-zinc-900 outline-none dark:bg-zinc-950 dark:text-zinc-100"
            />
          ) : (
            <span className="min-w-0 flex-1 truncate">{node.name}</span>
          )}

          {isMain && (
            <StarIcon width={13} height={13} className="shrink-0 fill-amber-400 text-amber-500" aria-label="Archivo principal" />
          )}
          <button
            type="button"
            aria-label={`Acciones de ${node.name}`}
            onClick={(e) => {
              e.stopPropagation();
              const rect = e.currentTarget.getBoundingClientRect();
              store.select(node.path);
              setMenu({ x: rect.left, y: rect.bottom, node });
            }}
            className="shrink-0 rounded p-0.5 text-zinc-500 opacity-0 hover:bg-zinc-200 group-hover:opacity-100 focus:opacity-100 dark:hover:bg-zinc-700"
          >
            <DotsIcon width={14} height={14} />
          </button>
        </div>
        {isFolder && isOpen && node.children.length > 0 && (
          <ul role="group">{node.children.map((child) => renderNode(child, depth + 1))}</ul>
        )}
      </li>
    );
  };

  const loading = fileIds === undefined || folderIds === undefined;

  return (
    <div className="flex h-full min-h-0 flex-col bg-zinc-50 dark:bg-zinc-900/50">
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-zinc-200 px-2 dark:border-zinc-800">
        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Archivos</span>
        <div className="flex gap-0.5">
          <IconButton label="Nuevo archivo" onClick={() => startCreate("file")}>
            <FilePlusIcon />
          </IconButton>
          <IconButton label="Nueva carpeta" onClick={() => startCreate("folder")}>
            <FolderPlusIcon />
          </IconButton>
          <IconButton label="Subir archivos" onClick={() => openUpload(targetFolder())}>
            <UploadIcon />
          </IconButton>
        </div>
      </div>

      <div
        className={`min-h-0 flex-1 overflow-auto py-1 ${dropTarget === "" ? "bg-emerald-50 dark:bg-emerald-950/20" : ""}`}
        onDragOver={(e) => onDragOver(e, "")}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropTarget(null);
        }}
        onDrop={(e) => onDrop(e, "")}
        onContextMenu={(e) => {
          e.preventDefault();
          setMenu({ x: e.clientX, y: e.clientY, node: null });
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) store.select(null);
        }}
      >
        {loading ? (
          <p className="px-3 py-2 text-xs text-zinc-500">Cargando…</p>
        ) : tree.children.length === 0 ? (
          <p className="px-3 py-2 text-xs text-zinc-500">Proyecto vacío. Crea o arrastra archivos aquí.</p>
        ) : (
          <ul role="tree" aria-label="Archivos del proyecto">
            {tree.children.map((n) => renderNode(n, 0))}
          </ul>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 border-t border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="font-medium hover:underline">
            Cerrar
          </button>
        </div>
      )}

      <input
        ref={setUploadInput}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) upload(fromFileList(e.target.files), uploadTarget);
          e.target.value = "";
        }}
      />

      {menu && <ContextMenu x={menu.x} y={menu.y} items={menuItems(menu.node)} onClose={() => setMenu(null)} />}

      <Dialog
        open={creating !== null}
        onClose={() => setCreating(null)}
        title={creating?.kind === "file" ? "Nuevo archivo" : "Nueva carpeta"}
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            submitCreate();
          }}
        >
          <Field label={`Nombre${creating?.parent ? ` (en ${creating.parent}/)` : ""}`}>
            <TextInput
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onFocus={(e) => {
                const dot = e.target.value.lastIndexOf(".");
                e.target.setSelectionRange(0, dot > 0 ? dot : e.target.value.length);
              }}
              placeholder={creating?.kind === "file" ? "capitulo.tex" : "figuras"}
            />
          </Field>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button onClick={() => setCreating(null)}>Cancelar</Button>
            <Button type="submit" variant="primary" disabled={!newName.trim()}>
              Crear
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={deleting?.type === "folder" ? "Eliminar carpeta" : "Eliminar archivo"}
        footer={
          <>
            <Button onClick={() => setDeleting(null)}>Cancelar</Button>
            <Button variant="danger" onClick={confirmDelete}>
              Eliminar
            </Button>
          </>
        }
      >
        <p>
          ¿Eliminar <strong className="break-all">{deleting?.path}</strong>
          {deleting?.type === "folder" ? " y todo su contenido" : ""}? No se puede deshacer.
        </p>
      </Dialog>
    </div>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="rounded p-1 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
    >
      {children}
    </button>
  );
}
