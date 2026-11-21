"use client";

import { useEffect, useState } from "react";
import { COMPILER_URL } from "@/lib/config";

type Status = "checking" | "online" | "offline";

const LABELS: Record<Status, string> = {
  checking: "Comprobando compilador…",
  online: "Compilador disponible",
  offline: "Compilador no disponible",
};

const DOT: Record<Status, string> = {
  checking: "bg-zinc-400",
  online: "bg-emerald-500",
  offline: "bg-red-500",
};

export function CompilerStatus() {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${COMPILER_URL}/health`, { signal: controller.signal })
      .then((res) => setStatus(res.ok ? "online" : "offline"))
      .catch((err) => {
        if (err.name !== "AbortError") setStatus("offline");
      });
    return () => controller.abort();
  }, []);

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={`h-2.5 w-2.5 rounded-full ${DOT[status]}`} />
      <span>{LABELS[status]}</span>
      <code className="text-zinc-500">{COMPILER_URL}</code>
    </div>
  );
}
