# syntax=docker/dockerfile:1
# Imagen del compilador: Node + TeX Live (paquetes de Debian) + backend.
# Contexto de build: ./backend  (ver docker-compose.yml)

# ---------- 1. Compilar el backend TypeScript ----------
FROM node:24-trixie-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

# ---------- 2. Imagen final con TeX Live ----------
FROM node:24-trixie-slim

ENV DEBIAN_FRONTEND=noninteractive

# TeX Live de Debian trixie (2024). Equivale aprox. a scheme-medium
# más colecciones habituales en documentos académicos en español/inglés.
RUN apt-get update && apt-get install -y --no-install-recommends \
      latexmk \
      texlive-latex-base \
      texlive-latex-recommended \
      texlive-latex-extra \
      texlive-fonts-recommended \
      texlive-plain-generic \
      texlive-xetex \
      texlive-luatex \
      texlive-science \
      texlive-pictures \
      texlive-bibtex-extra \
      texlive-publishers \
      texlive-lang-spanish \
      texlive-lang-english \
      texlive-lang-european \
      biber \
      lmodern \
      fonts-lmodern \
      fontconfig \
      ghostscript \
    && rm -rf /var/lib/apt/lists/* /usr/share/doc/*

# tini como PID 1: recoge los procesos huérfanos (zombies) que quedan
# al matar latexmk por timeout. Node como PID 1 no lo hace.
RUN apt-get update && apt-get install -y --no-install-recommends tini \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    PORT=4000 \
    HOST=0.0.0.0 \
    WORK_ROOT=/tmp/freelatex \
    TEXMFVAR=/home/node/.texlive/texmf-var

USER node
WORKDIR /app

# Precalentar la caché de fuentes de LuaLaTeX para que la primera
# compilación con lualatex no tarde minutos.
RUN mkdir -p "$TEXMFVAR" && luaotfload-tool --update --force >/dev/null 2>&1 || true

COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./

EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:4000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/server.js"]
