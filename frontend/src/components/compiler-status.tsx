"use client";

import { useCallback, useEffect, useState } from "react";
import { COMPILER_URL } from "@/lib/config";
import { RefreshIcon } from "@/components/ui/icons";
import { Tooltip } from "@/components/ui/tooltip";

type Status = "checking" | "online" | "offline";

const LABELS: Record<Status, string> = {
  checking: "Comprobando compilador…",
  online: "Compilador disponible",
  offline: "Compilador no disponible",
};

const DOT: Record<Status, string> = {
  checking: "bg-fg-subtle animate-pulse",
  online: "bg-accent",
  offline: "bg-danger",
};

export function CompilerStatus() {
  const [status, setStatus] = useState<Status>("checking");
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => {
    setStatus("checking");
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${COMPILER_URL}/health`, { signal: controller.signal })
      .then((res) => setStatus(res.ok ? "online" : "offline"))
      .catch((err) => {
        if (err.name !== "AbortError") setStatus("offline");
      });
    return () => controller.abort();
  }, [attempt]);

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end" aria-live="polite">
      <Tooltip content={`Servidor: ${COMPILER_URL}`}>
        <span
          tabIndex={0}
          className="inline-flex items-center gap-2 rounded-full border border-line bg-surface-muted px-3 py-1 text-sm text-fg-muted"
        >
          <span className={`h-2 w-2 rounded-full ${DOT[status]}`} aria-hidden="true" />
          {LABELS[status]}
        </span>
      </Tooltip>
      {status === "offline" && (
        <div className="flex max-w-xs flex-col gap-2 rounded-lg border border-danger-line bg-danger-soft p-3 text-xs text-danger-text sm:items-end sm:text-right">
          <p>
            Sin compilador no se puede generar el PDF. Abre Docker Desktop y ejecuta{" "}
            <code className="rounded bg-surface px-1 py-0.5 font-mono text-fg">npm run compiler:up</code>.
          </p>
          <button
            type="button"
            onClick={retry}
            className="inline-flex items-center gap-1.5 rounded-md border border-danger-line bg-surface px-2 py-1 font-medium text-fg hover:bg-surface-hover"
          >
            <RefreshIcon width={14} height={14} />
            Reintentar
          </button>
        </div>
      )}
    </div>
  );
}
