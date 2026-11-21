/** Preferencia de tema: guardada en localStorage y aplicada como <html data-theme>. */
export type ThemePref = "system" | "light" | "dark";

export const THEME_KEY = "freelatex-theme";
export const THEME_PREFS: ThemePref[] = ["system", "light", "dark"];

/**
 * Script que se ejecuta antes del primer pintado (inline en <head>) para evitar
 * el parpadeo del tema equivocado. Debe ser autocontenido.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var p=localStorage.getItem("${THEME_KEY}");var d=p==="dark"||(p!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light"}catch(e){document.documentElement.dataset.theme="light"}})()`;

export function readThemePref(): ThemePref {
  try {
    const value = localStorage.getItem(THEME_KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

const systemQuery = () => window.matchMedia("(prefers-color-scheme: dark)");

export function applyTheme(pref: ThemePref) {
  const dark = pref === "dark" || (pref === "system" && systemQuery().matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

export function saveThemePref(pref: ThemePref) {
  try {
    if (pref === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, pref);
  } catch {
    // Sin almacenamiento (modo privado): el tema dura hasta recargar.
  }
  applyTheme(pref);
}

/** Sigue los cambios del sistema mientras la preferencia sea "system". Devuelve la baja. */
export function watchSystemTheme(getPref: () => ThemePref): () => void {
  const query = systemQuery();
  const onChange = () => {
    if (getPref() === "system") applyTheme("system");
  };
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
