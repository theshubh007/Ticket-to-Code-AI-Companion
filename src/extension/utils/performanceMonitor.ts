export interface TimingResult {
  label: string;
  durationMs: number;
}

export class PerformanceMonitor {
  private timings: TimingResult[] = [];
  private starts: Map<string, number> = new Map();

  start(label: string) {
    this.starts.set(label, Date.now());
  }

  end(label: string): number {
    const start = this.starts.get(label);
    if (!start) return 0;
    const duration = Date.now() - start;
    this.timings.push({ label, durationMs: duration });
    this.starts.delete(label);
    return duration;
  }

  getSummary(): TimingResult[] {
    return [...this.timings];
  }

  log() {
    for (const t of this.timings) {
      console.log(`[perf] ${t.label}: ${t.durationMs}ms`);
    }
  }

  reset() {
    this.timings = [];
    this.starts.clear();
  }
}