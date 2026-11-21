import { CompilerStatus } from "@/components/compiler-status";
import { ImportZip } from "@/components/home/import-zip";
import { NewProjectButton } from "@/components/home/new-project-button";
import { ProjectList } from "@/components/home/project-list";
import { Logo } from "@/components/ui/icons";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-10 px-4 py-10 sm:px-6 sm:py-14">
      <div className="flex justify-end">
        <ThemeToggle />
      </div>
      <header className="flex flex-wrap items-start justify-between gap-6">
        <div className="flex items-center gap-4">
          <Logo size={48} className="shrink-0" />
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">FreeLaTeX</h1>
            <p className="text-fg-muted">Edita y compila LaTeX sin cuentas. Tus proyectos se guardan en este navegador.</p>
          </div>
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
