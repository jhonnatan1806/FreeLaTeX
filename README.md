# FreeLaTeX

Editor de LaTeX online sin cuentas: sube tu proyecto (ZIP), edítalo con árbol de archivos, compílalo y ve los errores mapeados a su línea.

Ver [PROYECTO.md](PROYECTO.md) para la arquitectura y el plan por fases.

## Estructura

| Carpeta | Contenido |
|---|---|
| `frontend/` | La web: Next.js + TypeScript + Tailwind (puerto **3000**) |
| `backend/` | El compilador: Node + Fastify, ejecuta `latexmk` (puerto **4000**) |
| `docker/` | Imagen del compilador con TeX Live y `docker-compose.yml` |
| `examples/` | Proyectos LaTeX de prueba |

---

## Cómo iniciarlo

### 1. Requisitos (una sola vez)

| Herramienta | Versión | Comprobar |
|---|---|---|
| [Node.js](https://nodejs.org) | 22 o superior | `node -v` |
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | cualquiera reciente | `docker --version` |
| Git | — | `git --version` |

> No necesitas instalar LaTeX en tu máquina: TeX Live va dentro del contenedor Docker.

### 2. Clonar e instalar dependencias (una sola vez)

```bash
git clone https://github.com/jhonnatan1806/FreeLaTeX.git
cd FreeLaTeX
npm run setup
```

`npm run setup` instala las dependencias de `frontend/` y `backend/`.

Opcional: copia la configuración del frontend si quieres cambiar la URL del compilador (por defecto es `http://localhost:4000`):

```bash
cp frontend/.env.example frontend/.env.local
```

### 3. Arrancar el compilador (Docker)

Abre **Docker Desktop** y espera a que diga que está en marcha. Luego, desde la raíz del repositorio:

```bash
npm run compiler:up
```

- La **primera vez** tarda varios minutos: descarga TeX Live y construye la imagen (~1,9 GB). Las siguientes veces arranca en segundos.
- Queda corriendo en segundo plano. Comprueba que responde abriendo <http://localhost:4000/health>; debe mostrar `{"ok":true,...}`.

### 4. Arrancar la web

En la misma terminal (o en otra):

```bash
npm run dev
```

Abre <http://localhost:3000>. Arriba a la derecha debe aparecer **"Compilador disponible"** en verde.

### 5. Detenerlo

- La web: `Ctrl + C` en la terminal donde corre `npm run dev`.
- El compilador:

```bash
npm run compiler:down
```

### Uso diario (resumen)

Con todo ya instalado, cada día solo necesitas:

```bash
npm run compiler:up
```

```bash
npm run dev
```

---

## Uso del editor

| Acción | Cómo |
|---|---|
| Abrir un archivo | Clic en el árbol de la izquierda (se abre en una pestaña) |
| Guardar | Automático al dejar de escribir |
| Compilar | Botón **Recompilar**, `Ctrl + Enter` o `Ctrl + S` (guarda y compila). Marca **Auto** para compilar cada vez que se guarda |
| Ver errores y avisos | Botón **Log** en la barra del PDF (muestra cuántos errores y avisos hay). Clic en `archivo, línea N` para saltar a esa línea. Los errores también se marcan en el margen del editor y con un punto rojo en el árbol |
| Buscar / reemplazar | `Ctrl + F` dentro del editor |
| Crear archivo o carpeta | Iconos de la barra del árbol, o clic derecho sobre una carpeta |
| Renombrar | `F2` sobre el elemento del árbol, o clic derecho → Renombrar |
| Mover | Arrastra el archivo o carpeta sobre otra carpeta (o al espacio vacío para la raíz) |
| Subir archivos o carpetas | Arrastra desde tu explorador al árbol, o el icono de subir |
| Archivo principal | Selector "Principal" arriba, o clic derecho sobre un `.tex` |

---

## Comandos útiles

Todos se ejecutan desde la raíz del repositorio.

| Comando | Qué hace |
|---|---|
| `npm run setup` | Instala dependencias de frontend y backend |
| `npm run compiler:up` | Construye (si hace falta) y arranca el compilador en Docker |
| `npm run compiler:down` | Detiene el compilador |
| `npm run compiler:logs` | Muestra los logs del compilador en vivo |
| `npm run dev` | Arranca la web en modo desarrollo |
| `npm test` | Ejecuta los tests del frontend |
| `npm run smoke` | Compila `examples/basico` contra el compilador y guarda el PDF en `backend/smoke-output/` |

Probar otro ejemplo o motor con el script de prueba:

```bash
cd backend
node scripts/smoke.mjs ../examples/subcarpeta tesis/main.tex xelatex
```

O directamente con `curl`:

```bash
curl -F project=@ejemplo.zip -F mainFile=main.tex -F engine=pdflatex http://localhost:4000/compile
```

---

## Problemas frecuentes

| Síntoma | Solución |
|---|---|
| `failed to connect to the docker API` / `daemon is not running` | Docker Desktop no está abierto. Ábrelo, espera a que arranque y repite `npm run compiler:up`. |
| La web dice **"Compilador no disponible"** | El contenedor no está corriendo: `npm run compiler:up`. Si sigue igual, revisa `npm run compiler:logs`. |
| `port is already allocated` (4000) o `Port 3000 is in use` | Otro programa usa el puerto. Ciérralo, o cambia el puerto en `docker/docker-compose.yml` (y `NEXT_PUBLIC_COMPILER_URL` en `frontend/.env.local`). |
| Error de CORS en la consola del navegador | El compilador solo acepta peticiones desde `http://localhost:3000`. Si usas otro origen, cambia `CORS_ORIGIN` en `docker/docker-compose.yml`. |
| Cambié código en `backend/` y no se nota | El backend corre dentro de la imagen: vuelve a ejecutar `npm run compiler:up` para reconstruirla. |
| Un cambio en el código de la web no se refleja | Recarga la página. Si sigue igual (pasa a veces con `globals.css`), detén `npm run dev` con `Ctrl + C` y vuelve a lanzarlo. |
| Mis proyectos no aparecen | Se guardan en el navegador (IndexedDB). Otro navegador, una ventana privada o borrar los datos del sitio no los muestran. Descarga el ZIP para guardar una copia. |

---

## Estado

- [x] Fase 0: estructura del repositorio
- [x] Fase 1: compilador en Docker (`POST /compile`)
- [x] Fase 2: proyectos locales en IndexedDB
- [x] Fase 3: importar y exportar ZIP
- [x] Fase 4: editor y árbol de archivos
- [x] Fase 5: compilar y ver el PDF
- [x] Fase 6: mapeo de errores
- [ ] Fase 7: SyncTeX y autocompletado
- [ ] Fase 8: producción
