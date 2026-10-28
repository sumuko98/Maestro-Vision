class Measurements {
  private series = new Map<string, number[]>();
  record(name: string, value: number) {
    const values = this.series.get(name) ?? [];
    if (values.length >= 300) values.shift();
    values.push(value);
    this.series.set(name, values);
  }
  snapshot() {
    return Object.fromEntries([...this.series].map(([name, values]) => {
      const sorted = [...values].sort((a, b) => a - b);
      return [name, { samples: sorted.length, median: sorted[Math.floor(sorted.length / 2)],
        p95: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] }];
    }));
  }
}
export const measurements = new Measurements();
