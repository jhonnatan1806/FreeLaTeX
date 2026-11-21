# FreeLaTeX

Editor de LaTeX online sin cuentas: sube tu proyecto (ZIP), edítalo con árbol de archivos, compílalo y ve los errores mapeados a su línea.

Ver [PROYECTO.md](PROYECTO.md) para la arquitectura y el plan por fases.

## Estructura

| Carpeta | Contenido |
|---|---|
| `frontend/` | Next.js (App Router) + TypeScript + Tailwind |
| `backend/` | Servicio de compilación (Node + Fastify) que ejecuta `latexmk` |
| `docker/` | Imagen del compilador con TeX Live y `docker-compose.yml` |

## Desarrollo

Requisitos: Node 22+ y Docker.

```bash
# Compilador (puerto 4000)
docker compose -f docker/docker-compose.yml up --build

# Frontend (puerto 3000)
cd frontend
npm install
npm run dev
```

La primera construcción de la imagen descarga TeX Live (imagen final de ~1,9 GB).

Probar el compilador con los proyectos de [examples/](examples/):

```bash
cd backend
npm install
node scripts/smoke.mjs ../examples/basico main.tex pdflatex
```

El PDF y el log quedan en `backend/smoke-output/`. También se puede usar `curl`:

```bash
curl -F project=@ejemplo.zip -F mainFile=main.tex -F engine=pdflatex http://localhost:4000/compile
```

## Estado

- [x] Fase 0: estructura del repositorio
- [x] Fase 1: compilador en Docker (`POST /compile`)
- [x] Fase 2: proyectos locales en IndexedDB
- [x] Fase 3: importar y exportar ZIP
- [ ] Fase 4: editor y árbol de archivos

## Tests

```bash
cd frontend
npm test
```
