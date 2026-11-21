"use client";

import { useEffect, useSyncExternalStore } from "react";
import { applyTheme, readThemePref, saveThemePref, THEME_KEY, watchSystemTheme, type ThemePref } from "@/lib/theme";
import { IconButton } from "./icon-button";
import { MonitorIcon, MoonIcon, SunIcon } from "./icons";

const CHANGE_EVENT = "freelatex-theme-change";

const NEXT: Record<ThemePref, ThemePref> = { system: "light", light: "dark", dark: "system" };
const LABEL: Record<ThemePref, string> = {
  system: "Tema: según el sistema",
  light: "Tema: claro",
  dark: "Tema: oscuro",
};
const ICON: Record<ThemePref, React.ReactNode> = {
  system: <MonitorIcon />,
  light: <SunIcon />,
  dark: <MoonIcon />,
};

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange); // otras pestañas
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Botón que alterna Sistema → Claro → Oscuro. */
export function ThemeToggle({ size = "md" }: { size?: "sm" | "md" }) {
  const pref = useSyncExternalStore(subscribe, readThemePref, () => "system" as const);

  useEffect(() => {
    const unwatch = watchSystemTheme(readThemePref);
    // Cambio hecho en otra pestaña.
    const onStorage = (e: StorageEvent) => e.key === THEME_KEY && applyTheme(readThemePref());
    window.addEventListener("storage", onStorage);
    return () => {
      unwatch();
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return (
    <IconButton
      size={size}
      label={`${LABEL[pref]} (clic para cambiar)`}
      onClick={() => {
        saveThemePref(NEXT[pref]);
        window.dispatchEvent(new Event(CHANGE_EVENT));
      }}
    >
      {ICON[pref]}
    </IconButton>
  );
}
