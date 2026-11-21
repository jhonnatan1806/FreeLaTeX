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

Probar el compilador directamente:

```bash
curl -F project=@ejemplo.zip -F mainFile=main.tex -F engine=pdflatex http://localhost:4000/compile
```
