import { CompilerStatus } from "@/components/compiler-status";
import { ImportZip } from "@/components/home/import-zip";
import { NewProjectButton } from "@/components/home/new-project-button";
import { ProjectList } from "@/components/home/project-list";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-4 py-12 sm:px-6 sm:py-16">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">FreeLaTeX</h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            Edita y compila LaTeX sin cuentas. Tus proyectos se guardan en este navegador.
          </p>
        </div>
        <CompilerStatus />
      </header>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Empezar</h2>
          <NewProjectButton />
        </div>
        <ImportZip />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Tus proyectos</h2>
        <ProjectList />
      </section>
    </main>
  );
}
