import { CompilerStatus } from "@/components/compiler-status";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-24">
      <header className="flex flex-col gap-3">
        <h1 className="text-4xl font-semibold tracking-tight">FreeLaTeX</h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400">
          Sube tu proyecto LaTeX, edítalo y compílalo. Sin cuentas: todo se
          guarda en tu navegador.
        </p>
      </header>

      <CompilerStatus />

      <section className="rounded-lg border border-dashed border-zinc-300 p-6 text-sm text-zinc-500 dark:border-zinc-700">
        Próximamente: crear proyecto en blanco, subir ZIP y lista de
        proyectos locales (fase 2 y 3).
      </section>
    </main>
  );
}
