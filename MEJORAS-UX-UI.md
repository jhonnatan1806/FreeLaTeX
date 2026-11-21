# Mejoras UX/UI de FreeLaTeX — plan por fases

Auditoría visual y de experiencia de usuario de la interfaz actual (`frontend/`), con las mejoras agrupadas en fases. Cada fase se puede entregar por separado y deja la aplicación en mejor estado que la anterior.

**Leyenda**

| Campo | Valores |
|---|---|
| Prioridad | 🔴 Alta · 🟡 Media · 🟢 Baja |
| Esfuerzo | **S** (< 2 h) · **M** (medio día) · **L** (1–2 días) |

---

## Diagnóstico general

Lo que ya funciona bien y hay que conservar:

- Interfaz limpia y sobria, sin ruido visual; paleta neutra (zinc) con un único color de acento (esmeralda).
- Modo oscuro automático vía `prefers-color-scheme`, incluido el resaltado de CodeMirror.
- Flujo principal corto: subir ZIP → elegir archivo principal → editar → compilar.
- Buenos detalles: errores con punto rojo en el árbol, estrella en el archivo principal, saltos SyncTeX con resaltado que se desvanece.

Problemas principales detectados:

1. **No hay sistema de diseño**: los colores Tailwind (`zinc-500`, `emerald-600`…) están escritos a mano en cada componente; los iconos de la barra del PDF son caracteres de texto (`−`, `+`, `⤓`).
2. **La cabecera del editor está saturada**: dos `<select>` nativos, dos botones de descarga, estado de guardado oculto en pantallas pequeñas y el botón *Descargar PDF* duplicado con el de la barra del PDF.
3. **Poca información de estado**: no se ve la página actual del PDF, ni si una pestaña tiene cambios sin guardar, ni avisos tipo *toast* tras acciones (duplicar, descargar, eliminar).
4. **Página de inicio plana**: cuatro botones de texto por proyecto, sin búsqueda, sin orden, sin plantillas.
5. **Descubribilidad baja**: los atajos solo aparecen en `title` o en el estado vacío; no hay paleta de comandos ni ayuda.
6. **No es usable en móvil/tablet**: tres paneles horizontales fijos.
7. **Accesibilidad parcial**: foco visible solo en `Button`, pestañas sin navegación con flechas, textos `text-[10px]` y grises de bajo contraste.

---

## Fase 0 — Fundamentos del sistema de diseño

> Objetivo: que todas las fases siguientes se construyan sobre tokens y componentes comunes, no sobre clases sueltas.

> **Estado: ✅ implementada**, salvo `Toast` y `Skeleton` de 0.5 (pasan a la fase 5, donde se usan) y la `og:image` de 0.7 (requiere la URL pública de la fase 8 del proyecto). Tokens en `app/globals.css`; componentes nuevos en `components/ui/` (`icon-button`, `tooltip`, `dropdown-menu`, `switch`, `kbd`, `badge`, `theme-toggle`).

| # | Mejora | Detalle | Archivos | Prio | Esf |
|---|---|---|---|---|---|
| 0.1 | **Tokens semánticos de color** | Definir en `globals.css` variables `--surface`, `--surface-muted`, `--border`, `--text`, `--text-muted`, `--accent`, `--accent-hover`, `--danger`, `--warning`, `--info` y exponerlas en `@theme`. Sustituir `bg-zinc-50 dark:bg-zinc-900/50`, etc., por `bg-surface-muted`. Elimina cientos de `dark:` duplicados. | `app/globals.css`, todos los componentes | 🔴 | L |
| 0.2 | **Selector de tema** | Claro / Oscuro / Sistema, guardado en `localStorage`. Hoy el tema depende solo del sistema operativo. Aplicar con `data-theme` en `<html>` y evitar el parpadeo con un script inline en `layout.tsx`. | `app/layout.tsx`, nuevo `components/ui/theme-toggle.tsx` | 🔴 | M |
| 0.3 | **Set de iconos único** | Adoptar `lucide-react` (o ampliar `icons.tsx`) y reemplazar los glifos `−`, `+`, `⤓`, `→` y el `PlayIcon` inline por iconos consistentes de 16 px. | `components/ui/icons.tsx`, `pdf/pdf-panel.tsx`, `editor/editor-pane.tsx` | 🔴 | M |
| 0.4 | **Escala tipográfica y de espaciado** | Fijar 4 tamaños de texto (`xs` 12, `sm` 13, `base` 14, `lg` 16) para la zona de trabajo y prohibir `text-[10px]`/`text-[11px]`. Alturas de barra unificadas (hoy hay `h-8`, `h-9`, `h-11`). | `globals.css`, barras de todos los paneles | 🟡 | S |
| 0.5 | **Componentes base que faltan** | `IconButton` (con `aria-label` y tooltip obligatorios), `Select` estilizado, `Toggle`/`Switch`, `Tooltip`, `Badge`, `Kbd`, `DropdownMenu`, `Toast`, `Skeleton`. | `components/ui/*` | 🔴 | L |
| 0.6 | **Variante `size` en `Button`** | `sm` / `md` en lugar de sobrescribir con `!py-1 text-xs` como ocurre en la cabecera del editor. | `components/ui/button.tsx`, `editor/editor-layout.tsx` | 🟡 | S |
| 0.7 | **Identidad visual** | Logotipo/monograma (p. ej. una "ƒ" o "∫" en esmeralda), favicon propio (hoy es el de Next.js) y `og:image`. | `app/favicon.ico`, `app/layout.tsx` | 🟢 | M |

**Hecho cuando:** ningún componente usa `dark:` para colores de superficie/texto, el tema se puede cambiar a mano y no queda ningún icono hecho con caracteres de texto.

---

## Fase 1 — Victorias rápidas (claridad inmediata)

> Cambios pequeños, de alto impacto, sin tocar la arquitectura.

> **Estado: ✅ implementada.** Además, el botón «Reintentar» del guardado vuelve a escribir los cambios que fallaron, y la barra del PDF se compacta según el ancho del panel (container queries).

| # | Mejora | Detalle | Archivos | Prio | Esf |
|---|---|---|---|---|---|
| 1.1 | **Quitar el botón duplicado de PDF** | *Descargar PDF* aparece en la cabecera y en la barra del PDF (`⤓`). Dejarlo solo en la barra del PDF y agrupar las descargas de la cabecera en un menú **Descargar ▾** (PDF · ZIP del proyecto). | `editor/editor-layout.tsx` | 🔴 | S |
| 1.2 | **Estado de guardado siempre visible** | Hoy tiene `hidden sm:inline`. Mostrar un icono (✓ nube / spinner / ⚠) siempre y el texto solo en pantallas anchas. El estado de error debe ser un botón que reintente. | `editor/editor-layout.tsx` | 🔴 | S |
| 1.3 | **Indicador de página del PDF** | `info.numPages` ya existe pero no se muestra. Añadir "Pág. 3 / 42" en la barra del PDF. | `pdf/pdf-panel.tsx`, `pdf/pdf-viewer.tsx` | 🔴 | S |
| 1.4 | **"Auto" como interruptor con etiqueta clara** | El checkbox nativo "Auto" no se entiende. Cambiar a un `Switch` con texto "Compilar al guardar" y tooltip. | `pdf/pdf-panel.tsx` | 🟡 | S |
| 1.5 | **Corregir el texto de atajos del estado vacío** | Dice "Ctrl+S guardar", pero Ctrl+S guarda **y compila**, y el guardado ya es automático. Cambiar a "Ctrl+S compilar". | `editor/editor-pane.tsx` | 🟡 | S |
| 1.6 | **Ocultar la URL técnica del compilador** | `CompilerStatus` muestra `http://localhost:4000`. Moverla a un tooltip; si está offline, mostrar una ayuda: "Arranca el compilador con `npm run compiler:up`" y un botón **Reintentar**. | `components/compiler-status.tsx` | 🟡 | S |
| 1.7 | **Agarre visible en los separadores** | Los separadores miden 1 px de ancho y cuesta encontrarlos. Área de arrastre de 6–8 px con línea fina centrada y un indicador `⋮` al pasar el ratón; cursor `col-resize`. | `editor/editor-layout.tsx` (`ResizeHandle`) | 🟡 | S |
| 1.8 | **Etiquetas en los selectores de la cabecera** | El selector de motor no tiene etiqueta visible (solo `aria-label`). Mostrar "Motor: pdfLaTeX" y "Principal: main.tex" como botones desplegables compactos. | `editor/editor-layout.tsx` | 🟡 | S |

**Hecho cuando:** la cabecera del editor tiene como máximo 4 controles visibles a la derecha y el usuario siempre sabe si su trabajo está guardado y en qué página del PDF está.

---

## Fase 2 — Página de inicio

> Objetivo: que la página de inicio sea un punto de partida cómodo y no solo una lista.

| # | Mejora | Detalle | Archivos | Prio | Esf |
|---|---|---|---|---|---|
| 2.1 | **Acciones del proyecto en menú contextual** | Sustituir los cuatro botones de texto (Renombrar, Duplicar, Descargar, Eliminar) por un botón `⋯` con menú. La fila entera se vuelve clicable para abrir el proyecto. | `home/project-list.tsx` | 🔴 | S |
| 2.2 | **Búsqueda y orden** | Campo "Buscar proyectos" y orden por *Última modificación / Nombre / Fecha de creación*. Imprescindible a partir de ~10 proyectos. | `home/project-list.tsx` | 🟡 | M |
| 2.3 | **Vista de tarjetas con miniatura** | Guardar en Dexie una miniatura de la primera página del último PDF compilado y mostrar una cuadrícula de tarjetas (alternable con vista lista). | `home/project-list.tsx`, `lib/db.ts`, `store/compile-store.ts` | 🟢 | L |
| 2.4 | **Plantillas al crear proyecto** | El diálogo "Nuevo proyecto" crea siempre un documento en blanco. Ofrecer tarjetas: *Artículo*, *Informe/Tesis*, *Presentación (Beamer)*, *Carta*, *CV*, *En blanco*. | `home/new-project-button.tsx`, `lib/projects.ts` | 🔴 | M |
| 2.5 | **Hero con las dos acciones principales** | Reordenar la sección "Empezar": dos tarjetas grandes lado a lado — **Nuevo proyecto** y **Subir ZIP** (con la zona de arrastre). Hoy el botón primario queda pequeño a la derecha del título. | `app/page.tsx`, `home/import-zip.tsx` | 🟡 | S |
| 2.6 | **Estado vacío ilustrado** | Sustituir "Aún no tienes proyectos…" por una ilustración ligera, una frase y los dos botones de acción. | `home/project-list.tsx` | 🟡 | S |
| 2.7 | **Aviso de almacenamiento local** | Banner discreto: "Tus proyectos solo viven en este navegador. Descarga un ZIP como copia de seguridad". Mostrar el espacio usado (`navigator.storage.estimate()`) y avisar cerca del límite. | `app/page.tsx` | 🟡 | M |
| 2.8 | **Zona de arrastre de ZIP en toda la página** | Al arrastrar un ZIP sobre cualquier parte de la página de inicio, mostrar una capa "Suelta para importar". | `app/page.tsx`, `home/import-zip.tsx` | 🟢 | S |
| 2.9 | **Importar ZIP: progreso y resumen visual** | Barra de progreso al analizar ZIP grandes; en el diálogo, chips con "42 archivos · 8 imágenes · 3,2 MB" en lugar de una frase larga. | `home/import-zip.tsx` | 🟢 | S |

**Hecho cuando:** un usuario nuevo puede empezar un documento útil (no en blanco) en dos clics y un usuario con 20 proyectos encuentra el suyo en segundos.

---

## Fase 3 — Espacio de trabajo del editor

> Objetivo: maximizar el área útil y que el entorno se sienta como un IDE moderno.

| # | Mejora | Detalle | Archivos | Prio | Esf |
|---|---|---|---|---|---|
| 3.1 | **Recordar el tamaño de los paneles** | Usar el guardado automático de `react-resizable-panels` (`autoSaveId`) para que los tamaños persistan entre sesiones. | `editor/editor-layout.tsx` | 🔴 | S |
| 3.2 | **Paneles plegables** | Botones para ocultar el árbol (`Ctrl+B`) y el PDF; doble clic en el separador para restaurar. Modo "solo código" y "solo PDF". | `editor/editor-layout.tsx` | 🔴 | M |
| 3.3 | **Barra de actividad lateral** | Sustituir las pestañas de texto "ARCHIVOS / BUSCAR" por una barra vertical de iconos (estilo VS Code): Archivos, Buscar, Esquema (fase 4). Gana espacio vertical. | `editor/side-panel.tsx` | 🟡 | M |
| 3.4 | **Pestañas con más información** | Icono por tipo de archivo, punto "●" si hay cambios pendientes de guardar, punto rojo si el archivo tiene errores, botón de cierre siempre visible (hoy en pestañas inactivas solo aparece al pasar el ratón). | `editor/editor-pane.tsx` | 🟡 | M |
| 3.5 | **Migas de pan del archivo** | Debajo de las pestañas: `capitulos › introduccion.tex › \section{Metodología}`. Clic en cada segmento para navegar. | `editor/editor-pane.tsx`, `lib/latex-index.ts` | 🟢 | M |
| 3.6 | **Barra de estado inferior** | Línea/columna, número de palabras, codificación, motor y último tiempo de compilación. Hoy esa información no existe o está repartida. | nuevo `editor/status-bar.tsx` | 🟡 | M |
| 3.7 | **Botón "Ir al PDF" con icono** | El texto "Ir al PDF →" ocupa espacio en la barra de pestañas. Pasar a `IconButton` con tooltip que muestre el atajo `Ctrl+Alt+J`. | `editor/editor-pane.tsx` | 🟢 | S |
| 3.8 | **Árbol de archivos más legible** | Iconos por extensión (`.tex`, `.bib`, `.sty`, `.cls`, imagen, PDF), líneas guía de indentación, nombre del archivo principal en negrita además de la estrella, y la barra "Proyecto" con el nombre real del proyecto. | `editor/file-tree.tsx` | 🟡 | M |
| 3.9 | **Ajustes del editor** | Diálogo con tamaño de fuente, ajuste de línea, tema del editor y tamaño de tabulación. | nuevo `editor/settings-dialog.tsx`, `codemirror-setup.ts` | 🟢 | M |

**Hecho cuando:** el usuario puede dedicar el 100 % de la pantalla al código o al PDF, y la distribución que elige se mantiene al volver.

---

## Fase 4 — Compilación, PDF y errores

> Objetivo: que compilar y corregir errores sea rápido y poco intimidante, sobre todo para quien empieza en LaTeX.

| # | Mejora | Detalle | Archivos | Prio | Esf |
|---|---|---|---|---|---|
| 4.1 | **Estado de compilación más expresivo** | Botón **Compilar** con tres estados visuales: listo, compilando (spinner + barra de progreso indeterminada fina bajo la barra) y resultado (✓ verde / ⚠ ámbar / ✕ rojo durante 2 s). Mostrar "Compilado hace 12 s" en lugar de ocultarlo por debajo de `lg`. | `pdf/pdf-panel.tsx` | 🔴 | M |
| 4.2 | **PDF desactualizado** | Si hay cambios guardados posteriores a la última compilación, mostrar una etiqueta "Cambios sin compilar" junto al botón. | `pdf/pdf-panel.tsx`, `store/compile-store.ts` | 🟡 | S |
| 4.3 | **Controles de zoom completos** | Desplegable de zoom: *Ajustar al ancho*, *Ajustar a la página*, 50–300 %. `Ctrl + rueda` para hacer zoom sobre el PDF. Hoy el porcentaje funciona como botón oculto de "ajustar al ancho". | `pdf/pdf-panel.tsx`, `pdf/pdf-viewer.tsx` | 🟡 | M |
| 4.4 | **Navegación del PDF** | Campo de página editable, botones anterior/siguiente, panel opcional de miniaturas y botón de pantalla completa / abrir en pestaña nueva. | `pdf/pdf-panel.tsx`, `pdf/pdf-viewer.tsx` | 🟡 | L |
| 4.5 | **Conservar la posición del PDF al recompilar** | Tras recompilar, mantener la página y el desplazamiento en lugar de volver arriba (si no ocurre ya), con una transición suave sin parpadeo blanco. | `pdf/pdf-viewer.tsx` | 🔴 | M |
| 4.6 | **Errores explicados en lenguaje humano** | Para los errores más comunes (`Undefined control sequence`, `Missing $ inserted`, `File not found`, `Runaway argument`…) añadir una línea "Qué significa / cómo arreglarlo" bajo el mensaje original. | `pdf/log-panel.tsx`, `lib/log-parser.ts` | 🔴 | M |
| 4.7 | **Panel de problemas sin perder el PDF** | Hoy el log reemplaza al PDF. Ofrecerlo como panel inferior desplegable (dividido) para ver errores y PDF a la vez. | `pdf/pdf-panel.tsx`, `pdf/log-panel.tsx` | 🟡 | M |
| 4.8 | **Navegar entre errores** | `F8` / `Shift+F8` para ir al siguiente/anterior error en el editor; contador "Error 2 de 5". | `editor/code-editor.tsx`, `store/compile-store.ts` | 🟡 | M |
| 4.9 | **Mejoras de la lista de errores** | Iconos en lugar de etiquetas en mayúsculas de 10 px, agrupar por archivo, botón "Copiar mensaje" y fragmento de código de la línea con el error resaltado. | `pdf/log-panel.tsx` | 🟢 | M |
| 4.10 | **Panel de esquema del documento** | Árbol de `\chapter`, `\section`, `\subsection`, figuras y tablas, con clic para saltar al código. Muy útil en tesis. | nuevo `editor/outline-panel.tsx`, `lib/latex-index.ts` | 🟡 | L |
| 4.11 | **Estado inicial del PDF con llamada a la acción** | "Pulsa Recompilar para generar el PDF" → tarjeta centrada con icono, botón **Compilar** grande y el atajo `Ctrl+Enter`. | `pdf/pdf-panel.tsx` | 🟢 | S |

**Hecho cuando:** un usuario novato entiende qué ha fallado sin leer el log completo y puede ver el error y el PDF a la vez.

---

## Fase 5 — Retroalimentación, estados y seguridad ante errores

> Objetivo: que cada acción tenga respuesta visible y que ningún error sea irreversible.

| # | Mejora | Detalle | Archivos | Prio | Esf |
|---|---|---|---|---|---|
| 5.1 | **Sistema de toasts** | Notificaciones breves abajo a la derecha para: proyecto duplicado, ZIP descargado, archivo movido, error de guardado, compilador desconectado. Hoy muchas acciones (Duplicar) no dan ninguna confirmación. | nuevo `components/ui/toast.tsx` | 🔴 | M |
| 5.2 | **Deshacer en eliminaciones** | Al eliminar un archivo o proyecto, ocultarlo y mostrar un toast "Eliminado · Deshacer" durante 8 s antes de borrarlo de verdad. Reduce el miedo a la acción destructiva. | `home/project-list.tsx`, `editor/file-tree.tsx`, `lib/projects.ts` | 🔴 | M |
| 5.3 | **Skeletons en lugar de "Cargando…"** | Esqueletos animados para la lista de proyectos, el árbol y la carga del editor. | `home/project-list.tsx`, `editor/editor-layout.tsx`, `editor/file-tree.tsx` | 🟡 | S |
| 5.4 | **Diálogos de confirmación más claros** | Icono de advertencia, botón destructivo con el verbo concreto ("Eliminar proyecto"), foco inicial en *Cancelar* y animación de entrada/salida. | `components/ui/dialog.tsx` | 🟡 | S |
| 5.5 | **Errores en línea con contexto** | Validación al escribir en nombres de archivo/proyecto (caracteres no válidos, nombre duplicado) con mensaje bajo el campo y el campo marcado en rojo, en vez de un error genérico al enviar. | `components/ui/field.tsx`, `editor/file-tree.tsx` | 🟡 | M |
| 5.6 | **Compilador caído durante la edición** | Banner persistente en el editor si `/health` falla, con botón **Reintentar** y enlace a la guía de arranque; desactivar el botón de compilar con explicación en tooltip. | `editor/editor-layout.tsx`, `components/compiler-status.tsx` | 🟡 | M |
| 5.7 | **Aviso al cerrar con cambios pendientes** | `beforeunload` si hay guardados en curso. | `editor/editor-layout.tsx` | 🟢 | S |

**Hecho cuando:** toda acción del usuario produce una respuesta visible en menos de 100 ms y borrar algo por error tiene arreglo.

---

## Fase 6 — Onboarding y descubribilidad

> Objetivo: que las funciones potentes (SyncTeX, autocompletado, búsqueda) se descubran sin leer el README.

| # | Mejora | Detalle | Archivos | Prio | Esf |
|---|---|---|---|---|---|
| 6.1 | **Paleta de comandos (`Ctrl+K`)** | Buscador universal: abrir archivo, compilar, cambiar motor, cambiar archivo principal, alternar tema, descargar, ir a sección. | nuevo `components/command-palette.tsx` | 🔴 | L |
| 6.2 | **Hoja de atajos (`?` o `Ctrl+/`)** | Modal con todos los atajos agrupados (Editor, Compilación, Navegación, Árbol). Accesible también desde un botón de ayuda en la cabecera. | nuevo `components/shortcuts-dialog.tsx` | 🔴 | M |
| 6.3 | **Tooltips con atajo** | Todos los botones de icono muestran tooltip con nombre + atajo (`Compilar  Ctrl+Enter`) usando el componente `Kbd`. | `components/ui/tooltip.tsx`, barras | 🟡 | S |
| 6.4 | **Recorrido guiado la primera vez** | 4–5 pasos al abrir el primer proyecto: árbol → editor → compilar → doble clic en el PDF → autocompletado. Se puede saltar y repetir desde Ayuda. | nuevo `components/onboarding-tour.tsx` | 🟡 | M |
| 6.5 | **Proyecto de ejemplo** | Botón "Abrir ejemplo" en la página de inicio que importe uno de `examples/` para probar sin tener nada propio. | `app/page.tsx`, `lib/projects.ts` | 🟢 | S |
| 6.6 | **Pistas contextuales** | Tras la primera compilación correcta, pista puntual: "Haz doble clic en el PDF para saltar al código". Se muestra una sola vez. | `pdf/pdf-panel.tsx` | 🟢 | S |
| 6.7 | **Barra de herramientas de formato opcional** | Botones para negrita, cursiva, sección, lista, figura, tabla, ecuación, que insertan el código LaTeX. Muy útil para usuarios que vienen de Word. | nuevo `editor/format-toolbar.tsx` | 🟡 | M |

**Hecho cuando:** un usuario nuevo descubre SyncTeX y el autocompletado en su primera sesión sin consultar documentación.

---

## Fase 7 — Accesibilidad (WCAG 2.2 AA)

| # | Mejora | Detalle | Archivos | Prio | Esf |
|---|---|---|---|---|---|
| 7.1 | **Contraste** | Revisar `text-zinc-500` sobre `bg-zinc-100`/`zinc-50` y `text-zinc-400` en iconos; las insignias blancas sobre `amber-500` no llegan a 4,5:1 (usar `amber-600` o texto oscuro). | tokens de la fase 0 | 🔴 | S |
| 7.2 | **Foco visible en todo** | Hoy solo `Button` tiene `focus-visible`. Aplicar un anillo de foco común a pestañas, chips de filtro, botones de la barra del PDF, selectores y elementos del árbol. | todos los componentes interactivos | 🔴 | M |
| 7.3 | **Pestañas accesibles** | `role="tab"` sin navegación por teclado: añadir flechas izquierda/derecha, `tabIndex` itinerante y `aria-controls`. Las pestañas del editor son `<div>` clicables: hacerlas operables con teclado. | `editor/editor-pane.tsx`, `editor/side-panel.tsx` | 🔴 | M |
| 7.4 | **Anuncios a lectores de pantalla** | Región `aria-live` para "Compilación correcta / 3 errores". El estado de guardado ya la tiene; extender al compilador. | `pdf/pdf-panel.tsx` | 🟡 | S |
| 7.5 | **Tamaño mínimo de objetivos** | Botones de la barra del PDF (24 px) y cierre de pestañas (16 px) → mínimo 24×24 px con área de toque de 32 px. | `pdf/pdf-panel.tsx`, `editor/editor-pane.tsx` | 🟡 | S |
| 7.6 | **Movimiento reducido** | Respetar `prefers-reduced-motion` en el resaltado SyncTeX, los spinners y las animaciones nuevas. | `app/globals.css` | 🟢 | S |
| 7.7 | **Color no como único indicador** | El punto rojo de errores en el árbol y los colores de los niveles del log deben ir acompañados de icono o texto. | `editor/file-tree.tsx`, `pdf/log-panel.tsx` | 🟡 | S |

**Hecho cuando:** toda la aplicación se puede usar solo con teclado y una auditoría con Lighthouse/axe no da errores de contraste ni de roles.

---

## Fase 8 — Responsive (tablet y móvil)

> Objetivo: poder revisar y hacer correcciones pequeñas desde una tablet o un móvil.

| # | Mejora | Detalle | Archivos | Prio | Esf |
|---|---|---|---|---|---|
| 8.1 | **Diseño por pestañas en pantallas estrechas** | Por debajo de 768 px, sustituir los tres paneles por una barra inferior con **Archivos · Código · PDF** a pantalla completa. | `editor/editor-layout.tsx` | 🔴 | L |
| 8.2 | **Tablet: dos paneles** | Entre 768 y 1024 px, árbol como cajón deslizante y editor + PDF en dos columnas. | `editor/editor-layout.tsx` | 🟡 | M |
| 8.3 | **Cabecera compacta** | En móvil, mover motor, archivo principal y descargas a un menú `⋯`; dejar visible solo nombre, guardado y compilar. | `editor/editor-layout.tsx` | 🟡 | M |
| 8.4 | **Gestos en el PDF** | Pellizcar para hacer zoom y deslizar entre páginas. | `pdf/pdf-viewer.tsx` | 🟢 | M |
| 8.5 | **Lista de proyectos táctil** | Filas más altas (≥ 48 px) y menú `⋯` grande en móvil. | `home/project-list.tsx` | 🟢 | S |

**Hecho cuando:** en un móvil de 375 px se puede abrir un proyecto, cambiar una línea, compilar y ver el PDF sin hacer zoom en la página.

---

## Fase 9 — Pulido y detalles de calidad

| # | Mejora | Detalle | Archivos | Prio | Esf |
|---|---|---|---|---|---|
| 9.1 | **Microinteracciones** | Transiciones de 150 ms en hover/abrir menús, fundido al cambiar de PDF, rotación suave de las flechas del árbol (ya existe), aparición de toasts. | global | 🟢 | M |
| 9.2 | **Temas del editor** | 2–3 temas de color para CodeMirror (claro, oscuro, alto contraste) seleccionables en los ajustes. | `app/globals.css`, `codemirror-setup.ts` | 🟢 | M |
| 9.3 | **Modo concentración** | `F11`/botón: oculta cabecera, árbol y barras; solo editor y PDF. | `editor/editor-layout.tsx` | 🟢 | S |
| 9.4 | **Celebración discreta** | Primera compilación correcta de un proyecto: breve animación en el botón de compilar. | `pdf/pdf-panel.tsx` | 🟢 | S |
| 9.5 | **Título de pestaña del navegador dinámico** | `● introduccion.tex — Mi tesis · FreeLaTeX` con indicador de errores/compilando. | `app/project/[id]/page.tsx` | 🟢 | S |
| 9.6 | **Coherencia de textos** | Guía de tono: verbos en infinitivo en botones ("Compilar" en lugar de alternar "Recompilar"/"Compilando…"), mayúscula solo inicial, mismos términos en todo (Aviso vs. Warning, Proyecto vs. Carpeta). | todos | 🟢 | S |

---

## Orden recomendado

```
Fase 0 ──► Fase 1 ──► Fase 5 ──► Fase 4 ──► Fase 2 ──► Fase 3 ──► Fase 6 ──► Fase 7 ──► Fase 8 ──► Fase 9
(base)    (rápidas)  (feedback) (errores)  (inicio)   (editor)   (descubrir)(a11y)     (móvil)    (pulido)
```

- **Fase 0 y 1 primero:** la base de tokens e iconos abarata todo lo demás, y las victorias rápidas se notan desde el primer día.
- **Fase 5 y 4 después:** toasts, deshacer y errores comprensibles son lo que más reduce la frustración en un editor LaTeX.
- **Fase 7 (accesibilidad)** conviene revisarla de forma continua en cada fase, aunque aquí aparezca como bloque propio.
- **Fase 8 (móvil)** es la más costosa y la de menor uso esperado; dejarla para cuando el escritorio esté pulido.

## Métricas para validar las mejoras

| Métrica | Cómo medirla | Objetivo |
|---|---|---|
| Tiempo hasta el primer PDF (usuario nuevo) | Prueba con 5 usuarios | < 60 s |
| Errores corregidos sin abrir el log completo | Observación en pruebas | > 80 % |
| Descubrimiento de SyncTeX en la 1.ª sesión | Pregunta tras la prueba | > 70 % |
| Puntuación de accesibilidad Lighthouse | Lighthouse en `/` y `/project/[id]` | ≥ 95 |
| Controles visibles en la cabecera del editor | Recuento | ≤ 6 |
