# LatexFree

Editor de LaTeX online inspirado en Overleaf, **sin cuentas**: subes tu proyecto (ZIP o archivos sueltos), lo editas con un árbol de archivos, lo compilas y ves los errores mapeados a la línea exacta.

- Los proyectos se guardan **en el navegador** (IndexedDB). El servidor no guarda nada.
- La compilación se hace en un **servicio propio con TeX Live dentro de Docker** (opción A).

---

## 1. Arquitectura

```
┌──────────────────────────┐        ┌──────────────────────────────┐
│  frontend (Next.js)      │        │  backend (compilador)        │
│                          │  HTTP  │                              │
│  - Árbol de archivos     │ ─────► │  POST /compile               │
│  - Editor CodeMirror 6   │        │   1. recibe archivos (zip)   │
│  - Visor PDF (pdf.js)    │ ◄───── │   2. latexmk en dir temporal │
│  - Panel de errores      │  PDF + │   3. devuelve PDF + log +    │
│  - IndexedDB (Dexie)     │  log   │      synctex                 │
└──────────────────────────┘        │   4. borra el dir temporal   │
                                    └──────────────────────────────┘
                                         corre dentro de Docker
                                         (imagen con TeX Live)
```

**Flujo de compilación**

1. El usuario pulsa *Recompilar* (o Ctrl+S).
2. El frontend empaqueta los archivos del proyecto desde IndexedDB en un zip (`fflate`).
3. Envía `POST /compile` con el zip, el archivo principal y el motor.
4. El backend descomprime en `/tmp/<uuid>`, ejecuta `latexmk` con timeout y límites, y responde.
5. El frontend muestra el PDF, parsea el `.log` y marca los errores en el editor.

---

## 2. Estructura de carpetas

```
LatexFree/
├── PROYECTO.md              ← este documento
├── README.md                ← cómo levantar el proyecto (se crea en la fase 0)
├── .gitignore
│
├── frontend/                ← Next.js (App Router) + TypeScript
│   ├── package.json
│   ├── next.config.ts
│   ├── .env.local           ← NEXT_PUBLIC_COMPILER_URL=http://localhost:4000
│   └── src/
│       ├── app/
│       │   ├── page.tsx                 ← inicio: lista de proyectos, nuevo, subir ZIP
│       │   └── project/[id]/page.tsx    ← el editor
│       ├── components/
│       │   ├── file-tree/               ← árbol (react-arborist)
│       │   ├── editor/                  ← CodeMirror 6 + lint de errores
│       │   ├── pdf-viewer/              ← pdf.js
│       │   └── logs-panel/              ← errores / warnings / log completo
│       ├── lib/
│       │   ├── db.ts                    ← Dexie (IndexedDB)
│       │   ├── zip.ts                   ← importar / exportar ZIP
│       │   ├── detect-main.ts           ← detectar archivo con \documentclass
│       │   ├── compile-client.ts        ← llamada al backend
│       │   └── log-parser.ts            ← parseo del .log de LaTeX
│       ├── store/                       ← Zustand (proyecto abierto, pestañas, estado)
│       └── types/
│
├── backend/                 ← servicio de compilación (Node + TypeScript + Fastify)
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── server.ts                    ← arranque Fastify, CORS, límites de subida
│       ├── routes/compile.ts            ← POST /compile
│       ├── routes/health.ts             ← GET /health
│       ├── compiler/latexmk.ts          ← ejecuta latexmk con timeout
│       ├── compiler/workspace.ts        ← crear / limpiar dir temporal, descomprimir
│       └── config.ts                    ← timeouts, tamaños máximos, motores permitidos
│
└── docker/
    ├── docker-compose.yml               ← levanta el backend (y opcionalmente el front)
    ├── compiler.Dockerfile              ← Node + TeX Live + backend compilado
    └── frontend.Dockerfile              ← (opcional, para producción)
```

---

## 3. Stack

| Capa | Tecnología | Motivo |
|---|---|---|
| Frontend | Next.js 15 (App Router), React, TypeScript, Tailwind | Lo pediste; buen DX y despliegue fácil |
| Editor | CodeMirror 6 + `codemirror-lang-latex` | Ligero; es el que usa Overleaf |
| Árbol | `react-arborist` | Drag & drop, renombrar y virtualización |
| Paneles | `react-resizable-panels` | Árbol / editor / PDF redimensionables |
| Estado | Zustand | Simple, sin boilerplate |
| Persistencia | Dexie (IndexedDB) | Guarda texto y binarios en el navegador |
| ZIP | `fflate` | Rápido, funciona en el navegador |
| PDF | `pdfjs-dist` / `react-pdf` | Estándar |
| Backend | Node 22 + Fastify + `@fastify/multipart` | Ligero; mismo lenguaje que el front |
| Compilación | TeX Live (`scheme-medium` + colecciones) + `latexmk` | Soporta pdflatex, xelatex, lualatex, bibtex y biber |
| Contenedor | Docker + docker-compose | Aislamiento y reproducibilidad |

---

## 4. Contrato de la API del compilador

### `POST /compile`

`multipart/form-data`:

| Campo | Tipo | Ejemplo |
|---|---|---|
| `project` | archivo `.zip` | todos los archivos del proyecto |
| `mainFile` | string | `main.tex` o `tesis/main.tex` |
| `engine` | `pdflatex` \| `xelatex` \| `lualatex` | `pdflatex` |

Respuesta `200` (JSON):

```json
{
  "status": "success",          // "success" | "error" | "timeout"
  "pdf": "<base64>",            // null si falló
  "log": "<contenido del .log>",
  "synctex": "<base64 gz>",     // para la fase 7
  "durationMs": 2310
}
```

> Más adelante se puede cambiar a devolver el PDF como binario con un id de compilación para no inflar el JSON con base64.

### `GET /health` → `{ "ok": true }`

### Seguridad (desde la fase 1)

- `latexmk` siempre **sin** `-shell-escape`.
- Timeout por compilación: 60 s (configurable).
- Tamaño máximo del zip: 50 MB.
- Rechazar rutas con `..` o absolutas dentro del zip (zip-slip).
- El contenedor corre como usuario sin privilegios, con límites de CPU y memoria en compose.
- El directorio temporal se borra siempre, aunque la compilación falle.

---

## 5. Fases

| Fase | Entregable | Hecho cuando… |
|---|---|---|
| **0. Base** | Carpetas `frontend/`, `backend/`, `docker/`, `git init`, `.gitignore`, README | `npm run dev` en el front muestra la página y el backend responde en `/health` |
| **1. Compilador** | Imagen Docker con TeX Live + endpoint `/compile` | Un `curl` con un zip devuelve el PDF y el log |
| **2. Proyectos locales** | Dexie + página de inicio (crear, listar, borrar, renombrar) | Los proyectos sobreviven a una recarga |
| **3. ZIP** | Importar y exportar ZIP, detectar el archivo principal | Subir un proyecto real de Overleaf y que aparezca completo |
| **4. Editor + árbol** | Tres paneles, árbol con CRUD y drag & drop, CodeMirror con pestañas y autoguardado | Se puede editar cualquier archivo y crear carpetas |
| **5. Compilar + PDF** | Botón y atajo para recompilar, visor PDF, selector de motor y archivo principal | Editar, Ctrl+S y ver el PDF actualizado |
| **6. Errores** | Parser del log, panel de errores, clic para saltar a la línea, marcas en el editor | Un `\textbf{` sin cerrar se marca en la línea correcta |
| **7. SyncTeX + edición** | Saltos código↔PDF, autocompletado de `\ref`/`\cite`, búsqueda global | Doble clic en el PDF lleva a la línea del código |
| **8. Producción** | Rate limiting, caché por hashes, despliegue (front en Vercel, backend en un VPS) | URL pública funcionando |

---

## 6. Cómo arrancaremos (fase 0 y 1)

Requisitos ya presentes en tu máquina: **Node 26** y **Docker 29**.

```bash
# 1. Repositorio
git init

# 2. Frontend
npx create-next-app@latest frontend --ts --tailwind --app --src-dir --eslint --use-npm

# 3. Backend
mkdir backend && cd backend && npm init -y
npm i fastify @fastify/multipart @fastify/cors fflate
npm i -D typescript tsx @types/node

# 4. Docker: construir la imagen del compilador y levantarla
docker compose -f docker/docker-compose.yml up --build
```

En desarrollo diario:

| Qué | Comando | Puerto |
|---|---|---|
| Frontend | `cd frontend && npm run dev` | 3000 |
| Compilador (Docker) | `docker compose -f docker/docker-compose.yml up` | 4000 |

> La primera construcción de la imagen tarda (TeX Live `scheme-medium` pesa ~2 GB). Después queda en caché.

---

## 7. Decisiones abiertas

- **Paquete TeX Live:** se usa TeX Live 2024 de Debian trixie (paquetes `texlive-latex-extra`, `-science`, `-pictures`, `-lang-spanish`, `biber`, etc.). La imagen pesa ~1,9 GB. Si faltan paquetes, añadir más `texlive-*` o pasar a la imagen oficial `texlive/texlive` (~5 GB).
- **Lectura de archivos fuera del proyecto:** TeX Live permite por defecto `\input{/ruta/absoluta}`. Dentro del contenedor no hay nada sensible, pero en la fase 8 conviene valorar `openin_any=p`.
- **Autocompilar:** ¿solo manual con Ctrl+S, o también automático con debounce? (Se decide en la fase 5.)
- **Límite de proyectos locales:** IndexedDB suele permitir cientos de MB; avisar al usuario si se acerca al límite.
