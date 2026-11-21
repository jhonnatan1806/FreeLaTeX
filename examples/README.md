# Proyectos de ejemplo

Sirven para probar el compilador (`backend/scripts/smoke.mjs`) y la importación de ZIP.

| Carpeta | Archivo principal | Qué prueba |
|---|---|---|
| `basico/` | `main.tex` | Varios archivos, `\input`, acentos y biblatex + biber |
| `con-error/` | `main.tex` | Errores de compilación (llave sin cerrar, comando indefinido) |
| `avisos/` | `main.tex` | Avisos (referencias, citas, overfull) y errores en un archivo incluido |
| `subcarpeta/` | `tesis/main.tex` | Archivo principal dentro de una subcarpeta |
