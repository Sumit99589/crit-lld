import type { JobQueue } from "../application/ports.js";

type Handler = (evaluationId: string) => Promise<void>;

/**
 * A deliberately small in-memory queue with bounded concurrency. The queue is
 * not the source of truth: every job's state lives in the evaluations table, so
 * losing this queue on restart only means `EvaluationWorker.recover()` re-fills
 * it. Swapping in a real broker means another JobQueue implementation.
 */
export class InProcessQueue implements JobQueue {
  private readonly pending: string[] = [];
  private readonly timers = new Set<NodeJS.Timeout>();
  private readonly idleWaiters: (() => void)[] = [];
  private active = 0;
  private handler: Handler | null = null;

  constructor(
    private readonly concurrency: number,
    private readonly onError: (error: unknown) => void = () => {},
  ) {}

  start(handler: Handler): void {
    this.handler = handler;
    this.pump();
  }

  enqueue(evaluationId: string, delayMs = 0): void {
    if (delayMs <= 0) return this.push(evaluationId);
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      this.push(evaluationId);
    }, delayMs);
    timer.unref();
    this.timers.add(timer);
  }

  /** Resolves once nothing is pending or running (delayed retries are not waited for). */
  onIdle(): Promise<void> {
    if (this.isIdle()) return Promise.resolve();
    return new Promise((resolve) => this.idleWaiters.push(resolve));
  }

  stop(): void {
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
    this.handler = null;
  }

  private push(evaluationId: string): void {
    if (!this.pending.includes(evaluationId)) this.pending.push(evaluationId);
    this.pump();
  }

  private pump(): void {
    while (this.handler && this.active < this.concurrency && this.pending.length > 0) {
      const id = this.pending.shift()!;
      this.active += 1;
      this.handler(id)
        .catch(this.onError)
        .finally(() => {
          this.active -= 1;
          this.pump();
          if (this.isIdle()) this.idleWaiters.splice(0).forEach((resolve) => resolve());
        });
    }
  }

  private isIdle(): boolean {
    return this.active === 0 && this.pending.length === 0;
  }
}
