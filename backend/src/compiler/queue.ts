/** Semáforo simple para limitar compilaciones simultáneas. */
export class Queue {
  private running = 0;
  private waiting: Array<() => void> = [];

  constructor(private readonly limit: number) {}

  get pending(): number {
    return this.waiting.length;
  }

  async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.running < this.limit) {
      this.running += 1;
    } else {
      // El hueco se nos cede directamente al liberarse (running no cambia).
      await new Promise<void>((resolve) => this.waiting.push(resolve));
    }
    try {
      return await task();
    } finally {
      const next = this.waiting.shift();
      if (next) next();
      else this.running -= 1;
    }
  }
}
